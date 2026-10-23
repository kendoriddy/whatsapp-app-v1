import { and, desc, eq, ne } from "drizzle-orm";
import {
  contact,
  conversation,
  featureFlag,
  orders,
  outboundMessage,
  paymentRequest,
  quote,
} from "@mmabon/db";
import { nextOrderRef, SEND_ROLES } from "@mmabon/domain";
import { createPaystackClient } from "@mmabon/paystack";
import { isWindowOpen, loadEnv } from "@mmabon/shared";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";
import { sendOutboundInline } from "@/lib/run-wa-jobs";
import { getQueue } from "@/lib/queue";
import { Jobs } from "@mmabon/queue";

function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolveChargeKobo(args: {
  totalKobo: number;
  paymentKind: "deposit" | "balance" | "full";
  depositPercent?: number;
  depositAmountNaira?: number;
}): { chargeKobo: number; paymentKind: "deposit" | "balance" | "full" } {
  const { totalKobo } = args;
  if (args.paymentKind === "full") {
    return { chargeKobo: totalKobo, paymentKind: "full" };
  }

  if (args.paymentKind === "balance") {
    // Caller should pass remaining as deposit_amount_naira for balance links.
    const bal = nairaToKobo(Number(args.depositAmountNaira ?? 0));
    if (bal <= 0 || bal > totalKobo) {
      throw Object.assign(new Error("Invalid balance amount"), {
        status: 400,
        code: "VALIDATION",
      });
    }
    return {
      chargeKobo: bal,
      paymentKind: bal >= totalKobo ? "full" : "balance",
    };
  }

  // deposit
  let charge = 0;
  if (
    typeof args.depositPercent === "number" &&
    Number.isFinite(args.depositPercent) &&
    args.depositPercent > 0
  ) {
    if (args.depositPercent > 100) {
      throw Object.assign(new Error("deposit_percent must be 1–100"), {
        status: 400,
        code: "VALIDATION",
      });
    }
    charge = Math.round((totalKobo * args.depositPercent) / 100);
  } else if (
    typeof args.depositAmountNaira === "number" &&
    Number.isFinite(args.depositAmountNaira) &&
    args.depositAmountNaira > 0
  ) {
    charge = nairaToKobo(args.depositAmountNaira);
  } else {
    throw Object.assign(
      new Error("Provide deposit_percent or deposit_amount_naira"),
      { status: 400, code: "VALIDATION" },
    );
  }

  if (charge <= 0) {
    throw Object.assign(new Error("Deposit must be greater than 0"), {
      status: 400,
      code: "VALIDATION",
    });
  }
  if (charge > totalKobo) {
    throw Object.assign(new Error("Deposit cannot exceed invoice total"), {
      status: 400,
      code: "VALIDATION",
    });
  }
  if (charge >= totalKobo) {
    return { chargeKobo: totalKobo, paymentKind: "full" };
  }
  return { chargeKobo: charge, paymentKind: "deposit" };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "quotes_payments");
    if (!(SEND_ROLES as string[]).includes(user.role)) {
      return jsonError("FORBIDDEN", "Cannot create invoices", 403);
    }

    const { id: conversationId } = await ctx.params;
    const body = (await req.json()) as {
      description?: string;
      amount_naira?: number;
      delivery_naira?: number;
      discount_naira?: number;
      payment_kind?: "deposit" | "balance" | "full";
      /** 1–100 when payment_kind=deposit */
      deposit_percent?: number;
      /** Fixed ₦ when payment_kind=deposit or balance */
      deposit_amount_naira?: number;
      customer_email?: string;
    };

    const description = (body.description ?? "Order").trim().slice(0, 200);
    const amountNaira = Number(body.amount_naira);
    if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
      return jsonError(
        "VALIDATION",
        "amount_naira must be a positive number",
        400,
      );
    }
    const deliveryKobo = nairaToKobo(Number(body.delivery_naira ?? 0) || 0);
    const discountKobo = nairaToKobo(Number(body.discount_naira ?? 0) || 0);
    const subtotalKobo = nairaToKobo(amountNaira);
    const totalKobo = subtotalKobo + deliveryKobo - discountKobo;
    if (totalKobo <= 0) {
      return jsonError("VALIDATION", "Total must be greater than 0", 400);
    }

    const requestedKind = body.payment_kind ?? "full";
    let chargeKobo: number;
    let paymentKind: "deposit" | "balance" | "full";
    try {
      const resolved = resolveChargeKobo({
        totalKobo,
        paymentKind: requestedKind,
        depositPercent:
          body.deposit_percent !== undefined
            ? Number(body.deposit_percent)
            : undefined,
        depositAmountNaira:
          body.deposit_amount_naira !== undefined
            ? Number(body.deposit_amount_naira)
            : undefined,
      });
      chargeKobo = resolved.chargeKobo;
      paymentKind = resolved.paymentKind;
    } catch (err) {
      const status = (err as { status?: number }).status ?? 400;
      return jsonError("VALIDATION", (err as Error).message, status);
    }

    const remainingAfterThisKobo = Math.max(0, totalKobo - chargeKobo);
    const depositPercentApplied =
      paymentKind === "deposit" && totalKobo > 0
        ? Math.round((chargeKobo / totalKobo) * 1000) / 10
        : paymentKind === "full"
          ? 100
          : null;

    const db = getDb();
    const env = loadEnv();

    const [ordersFlag] = await db
      .select()
      .from(featureFlag)
      .where(eq(featureFlag.key, "orders.module"))
      .limit(1);
    const [payFlag] = await db
      .select()
      .from(featureFlag)
      .where(eq(featureFlag.key, "payments.paystack"))
      .limit(1);
    if (!ordersFlag?.enabled || !payFlag?.enabled) {
      return jsonError(
        "CONFLICT",
        "Enable orders.module and payments.paystack feature flags",
        409,
      );
    }

    const [conv] = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1);
    if (!conv) return jsonError("NOT_FOUND", "Conversation not found", 404);

    if (
      !isWindowOpen(
        conv.lastInboundAt,
        new Date(),
        env.WINDOW_SAFETY_MARGIN_SECONDS,
      )
    ) {
      return jsonError(
        "WINDOW_CLOSED",
        "The 24-hour window has closed. Open a new customer message first, or send via a payment_link template.",
        422,
      );
    }

    const [c] = await db
      .select()
      .from(contact)
      .where(eq(contact.id, conv.contactId))
      .limit(1);
    if (!c) return jsonError("NOT_FOUND", "Contact not found", 404);

    const email =
      (body.customer_email ?? c.email)?.trim() ||
      `wa${c.waId}@${env.PAYSTACK_FALLBACK_EMAIL_DOMAIN}`;

    let [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.conversationId, conversationId),
          ne(orders.stage, "lost"),
          ne(orders.stage, "fulfilled"),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);

    if (!order) {
      const year = new Date().getFullYear();
      const existing = await db.select({ id: orders.id }).from(orders);
      const ref = nextOrderRef(year, existing.length + 1);
      const [created] = await db
        .insert(orders)
        .values({
          ref,
          contactId: c.id,
          conversationId,
          ownerId: user.id,
          stage: "quoted",
          budgetKobo: totalKobo,
        })
        .returning();
      order = created!;
    } else {
      await db
        .update(orders)
        .set({ stage: "quoted", budgetKobo: totalKobo, updatedAt: new Date() })
        .where(eq(orders.id, order.id));
    }

    const priorQuotes = await db
      .select({ version: quote.version })
      .from(quote)
      .where(eq(quote.orderId, order.id))
      .orderBy(desc(quote.version))
      .limit(1);
    const version = (priorQuotes[0]?.version ?? 0) + 1;
    const quoteRef = `${order.ref}-Q`;

    await db
      .update(quote)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(
        and(
          eq(quote.orderId, order.id),
          ne(quote.status, "superseded"),
          ne(quote.status, "accepted"),
        ),
      );

    const [q] = await db
      .insert(quote)
      .values({
        orderId: order.id,
        ref: quoteRef,
        version,
        status: "draft",
        items: [
          {
            label: description,
            qty: 1,
            unit_kobo: subtotalKobo,
            line_kobo: subtotalKobo,
          },
        ],
        subtotalKobo,
        deliveryKobo,
        discountKobo,
        totalKobo,
        createdBy: user.id,
      })
      .returning();

    const priorPays = await db
      .select({ id: paymentRequest.id })
      .from(paymentRequest)
      .where(eq(paymentRequest.quoteId, q!.id));
    const paySeq = priorPays.length + 1;
    const kindCode =
      paymentKind === "deposit"
        ? "DEP"
        : paymentKind === "balance"
          ? "BAL"
          : "FULL";
    const reference = `${quoteRef}-v${version}-${kindCode}-${paySeq}`.replace(
      /[^A-Za-z0-9_-]/g,
      "",
    );

    const callbackBase = env.PAYSTACK_CALLBACK_URL.replace(/\/$/, "");
    const callbackUrl = `${callbackBase}?reference=${encodeURIComponent(reference)}`;

    const paystack = createPaystackClient(env.PAYSTACK_SECRET_KEY);
    const init = await paystack.initializeTransaction({
      email,
      amountKobo: chargeKobo,
      reference,
      callbackUrl,
      metadata: {
        order_id: order.id,
        quote_id: q!.id,
        conversation_id: conversationId,
        order_ref: order.ref,
        kind: paymentKind,
        quote_total_kobo: totalKobo,
        charge_kobo: chargeKobo,
        remaining_kobo: remainingAfterThisKobo,
        deposit_percent: depositPercentApplied,
        description,
      },
    });

    const [pay] = await db
      .insert(paymentRequest)
      .values({
        orderId: order.id,
        quoteId: q!.id,
        kind: paymentKind,
        amountKobo: chargeKobo,
        paystackReference: init.reference,
        paystackAccessCode: init.access_code,
        authorizationUrl: init.authorization_url,
        customerEmailUsed: email,
        status: "created",
        createdBy: user.id,
      })
      .returning();

    const kindLabel =
      paymentKind === "deposit"
        ? `Deposit${depositPercentApplied != null ? ` (${depositPercentApplied}%)` : ""}`
        : paymentKind === "balance"
          ? "Balance"
          : "Full payment";

    const linkBody = [
      `Hello${c.profileName ? ` ${c.profileName}` : ""},`,
      ``,
      `Invoice ${quoteRef} v${version} — ${description}`,
      `Invoice total: ${formatNaira(totalKobo)}`,
      `${kindLabel} due now: ${formatNaira(chargeKobo)}`,
      remainingAfterThisKobo > 0
        ? `Remaining after this payment: ${formatNaira(remainingAfterThisKobo)}`
        : `Remaining after this payment: ${formatNaira(0)} (fully covered)`,
      ``,
      `Pay securely here:`,
      init.authorization_url,
      ``,
      `Reference: ${init.reference}`,
    ].join("\n");

    const [outbound] = await db
      .insert(outboundMessage)
      .values({
        conversationId,
        kind: "text",
        bodyText: linkBody,
        origin: "payment_link",
        status: "approved",
        createdBy: user.id,
        approvedBy: user.id,
        approvedAt: new Date(),
        orderId: order.id,
        idempotencyKey: `paylink-${pay!.id}`,
      })
      .returning();

    await db
      .update(paymentRequest)
      .set({ linkOutboundId: outbound!.id })
      .where(eq(paymentRequest.id, pay!.id));

    try {
      await sendOutboundInline(outbound!.id);
    } catch (sendErr) {
      console.error("[invoice] inline send failed", sendErr);
      try {
        const queue = await getQueue();
        await queue.send(
          Jobs.WA_SEND_OUTBOUND,
          { outboundId: outbound!.id },
          { singletonKey: `send-${outbound!.id}` },
        );
      } catch (enqueueErr) {
        console.error("[invoice] enqueue failed", enqueueErr);
      }
    }

    const [sentOut] = await db
      .select()
      .from(outboundMessage)
      .where(eq(outboundMessage.id, outbound!.id))
      .limit(1);

    if (sentOut?.status === "sent") {
      await db
        .update(quote)
        .set({
          status: "sent",
          sentOutboundId: outbound!.id,
          updatedAt: new Date(),
        })
        .where(eq(quote.id, q!.id));
      await db
        .update(paymentRequest)
        .set({ status: "link_sent", updatedAt: new Date() })
        .where(eq(paymentRequest.id, pay!.id));
    }

    const [freshPay] = await db
      .select()
      .from(paymentRequest)
      .where(eq(paymentRequest.id, pay!.id))
      .limit(1);
    const [freshQuote] = await db
      .select()
      .from(quote)
      .where(eq(quote.id, q!.id))
      .limit(1);

    return Response.json({
      order,
      quote: freshQuote,
      payment: freshPay,
      outbound: sentOut,
      authorization_url: init.authorization_url,
      totals: {
        invoice_total_kobo: totalKobo,
        charge_kobo: chargeKobo,
        remaining_kobo: remainingAfterThisKobo,
        payment_kind: paymentKind,
        deposit_percent: depositPercentApplied,
      },
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
