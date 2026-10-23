import { eq } from "drizzle-orm";
import { auditLog, outboundMessage } from "@mmabon/db";
import { SEND_ROLES } from "@mmabon/domain";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";
import { sendOutboundInline } from "@/lib/run-wa-jobs";
import { getQueue } from "@/lib/queue";
import { Jobs } from "@mmabon/queue";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "send_approve");
    if (!(SEND_ROLES as string[]).includes(user.role)) {
      return jsonError("FORBIDDEN", "Cannot approve sends", 403);
    }

    const { id } = await ctx.params;
    const body = (await req.json()) as {
      action?: "approve" | "reject";
      reason?: string;
    };
    const action = body.action ?? "approve";
    const db = getDb();

    const [row] = await db
      .select()
      .from(outboundMessage)
      .where(eq(outboundMessage.id, id))
      .limit(1);
    if (!row) return jsonError("NOT_FOUND", "Outbound not found", 404);
    if (row.status !== "pending_approval") {
      return jsonError(
        "CONFLICT",
        `Expected pending_approval, got ${row.status}`,
        409,
      );
    }

    if (action === "reject") {
      const [updated] = await db
        .update(outboundMessage)
        .set({
          status: "rejected",
          rejectedBy: user.id,
          rejectedReason: body.reason?.trim() || "Rejected",
          updatedAt: new Date(),
        })
        .where(eq(outboundMessage.id, id))
        .returning();
      await db.insert(auditLog).values({
        actorKind: "staff",
        actorId: user.id,
        action: "outbound.reject",
        entityType: "outbound_message",
        entityId: id,
        before: { status: row.status },
        after: { status: "rejected", reason: body.reason },
      });
      return Response.json(updated);
    }

    const [updated] = await db
      .update(outboundMessage)
      .set({
        status: "approved",
        approvedBy: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(outboundMessage.id, id))
      .returning();

    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "outbound.approve",
      entityType: "outbound_message",
      entityId: id,
      before: { status: row.status },
      after: { status: "approved" },
    });

    try {
      await sendOutboundInline(id);
    } catch (sendErr) {
      console.error("[approvals] inline send failed", sendErr);
      try {
        const queue = await getQueue();
        await queue.send(
          Jobs.WA_SEND_OUTBOUND,
          { outboundId: id },
          { singletonKey: `send-${id}` },
        );
      } catch (enqueueErr) {
        return jsonError("SEND_ENQUEUE_FAILED", String(enqueueErr), 500);
      }
    }

    const [fresh] = await db
      .select()
      .from(outboundMessage)
      .where(eq(outboundMessage.id, id))
      .limit(1);
    return Response.json(fresh ?? updated);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
