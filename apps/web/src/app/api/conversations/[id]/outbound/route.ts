import { eq } from "drizzle-orm";
import { outboundMessage, conversation, featureFlag } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, jsonError, assertCan } from "@/lib/auth";
import { isWindowOpen, loadEnv } from "@mmabon/shared";
import { Jobs } from "@mmabon/queue";
import { SEND_ROLES } from "@mmabon/domain";
import { getQueue } from "@/lib/queue";
import { sendOutboundInline } from "@/lib/run-wa-jobs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    const { id: conversationId } = await ctx.params;
    const body = (await req.json()) as {
      kind: "text" | "media" | "template";
      body_text?: string;
      template_id?: string;
      template_params?: { body: string[] };
      action: "send" | "submit" | "save_draft";
      idempotency_key: string;
    };

    const db = getDb();
    const env = loadEnv();
    const [conv] = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, conversationId))
      .limit(1);
    if (!conv) return jsonError("NOT_FOUND", "Conversation not found", 404);

    if (body.kind !== "template" && body.action !== "save_draft") {
      if (
        !isWindowOpen(
          conv.lastInboundAt,
          new Date(),
          env.WINDOW_SAFETY_MARGIN_SECONDS,
        )
      ) {
        return jsonError(
          "WINDOW_CLOSED",
          "The 24-hour window has closed. Choose an approved template.",
          422,
        );
      }
    }

    const [paused] = await db
      .select()
      .from(featureFlag)
      .where(eq(featureFlag.key, "sends.paused"))
      .limit(1);
    if (paused?.enabled && body.action === "send") {
      return jsonError("SENDS_PAUSED", "Sending is paused", 422);
    }

    let status: "draft" | "pending_approval" | "approved" = "draft";
    let approvedBy: string | null = null;
    let approvedAt: Date | null = null;

    if (body.action === "send") {
      assertCan(user, "send_approve");
      if (!(SEND_ROLES as string[]).includes(user.role)) {
        return jsonError("FORBIDDEN", "Cannot send", 403);
      }
      status = "approved";
      approvedBy = user.id;
      approvedAt = new Date();
    } else if (body.action === "submit") {
      status = "pending_approval";
    }

    const [row] = await db
      .insert(outboundMessage)
      .values({
        conversationId,
        kind: body.kind,
        bodyText: body.body_text ?? null,
        templateId: body.template_id ?? null,
        templateParams: body.template_params ?? null,
        origin: "staff_composed",
        status,
        createdBy: user.id,
        approvedBy,
        approvedAt,
        idempotencyKey: body.idempotency_key,
      })
      .returning();

    if (status === "approved") {
      try {
        await sendOutboundInline(row!.id);
      } catch (sendErr) {
        console.error("[outbound] inline send failed", sendErr);
        try {
          const queue = await getQueue();
          await queue.send(
            Jobs.WA_SEND_OUTBOUND,
            { outboundId: row!.id },
            { singletonKey: `send-${row!.id}` },
          );
        } catch (enqueueErr) {
          console.error("[outbound] enqueue failed", enqueueErr);
          return jsonError("SEND_ENQUEUE_FAILED", String(enqueueErr), 500);
        }
      }
    }

    return Response.json(row);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
