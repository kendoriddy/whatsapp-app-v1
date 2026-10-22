import { eq } from "drizzle-orm";
import { message, auditLog } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "override_classification");
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      label: "inquiry" | "complaint" | "order" | "spam";
    };
    const db = getDb();
    const [before] = await db
      .select()
      .from(message)
      .where(eq(message.id, id))
      .limit(1);
    if (!before) return jsonError("NOT_FOUND", "Message not found", 404);
    const [after] = await db
      .update(message)
      .set({
        classificationOverride: body.label,
        classificationOverrideBy: user.id,
        classificationOverrideAt: new Date(),
        classification: body.label,
        classificationNeedsReview: false,
      })
      .where(eq(message.id, id))
      .returning();
    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "message.classification_override",
      entityType: "message",
      entityId: id,
      before: { classification: before.classification },
      after: { classification: body.label },
    });
    return Response.json(after);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
