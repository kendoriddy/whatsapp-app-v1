import { eq } from "drizzle-orm";
import { auditLog, knowledgeDoc } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const { id } = await ctx.params;
    const [row] = await getDb()
      .select()
      .from(knowledgeDoc)
      .where(eq(knowledgeDoc.id, id))
      .limit(1);
    if (!row) return jsonError("NOT_FOUND", "Document not found", 404);
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      title?: string;
      markdown?: string;
      enabled?: boolean;
    };

    const db = getDb();
    const [before] = await db
      .select()
      .from(knowledgeDoc)
      .where(eq(knowledgeDoc.id, id))
      .limit(1);
    if (!before) return jsonError("NOT_FOUND", "Document not found", 404);

    const patch: {
      title?: string;
      markdown?: string;
      charCount?: number;
      enabled?: boolean;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (typeof body.title === "string" && body.title.trim()) {
      patch.title = body.title.trim();
    }
    if (typeof body.markdown === "string") {
      patch.markdown = body.markdown;
      patch.charCount = body.markdown.length;
    }
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;

    const [row] = await db
      .update(knowledgeDoc)
      .set(patch)
      .where(eq(knowledgeDoc.id, id))
      .returning();

    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "knowledge_doc.update",
      entityType: "knowledge_doc",
      entityId: id,
      before: {
        title: before.title,
        enabled: before.enabled,
        charCount: before.charCount,
      },
      after: {
        title: row!.title,
        enabled: row!.enabled,
        charCount: row!.charCount,
      },
    });

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

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const { id } = await ctx.params;
    const db = getDb();
    const [before] = await db
      .select()
      .from(knowledgeDoc)
      .where(eq(knowledgeDoc.id, id))
      .limit(1);
    if (!before) return jsonError("NOT_FOUND", "Document not found", 404);

    await db.delete(knowledgeDoc).where(eq(knowledgeDoc.id, id));
    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "knowledge_doc.delete",
      entityType: "knowledge_doc",
      entityId: id,
      before: { title: before.title },
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
