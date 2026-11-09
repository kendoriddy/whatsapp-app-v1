import { eq } from "drizzle-orm";
import { auditLog, knowledgeDoc } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";
import { replaceKnowledgeChunks } from "@/lib/knowledge-chunks";
import {
  deleteKnowledgeFile,
  downloadKnowledgeFile,
} from "@/lib/knowledge-storage";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const download = url.searchParams.get("download") === "1";

    const [row] = await getDb()
      .select()
      .from(knowledgeDoc)
      .where(eq(knowledgeDoc.id, id))
      .limit(1);
    if (!row) return jsonError("NOT_FOUND", "Document not found", 404);

    if (download) {
      if (!row.storagePath) {
        // Pasted markdown — return as a .md download.
        return new Response(row.markdown, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${row.sourceFilename.replace(/"/g, "")}"`,
          },
        });
      }
      const file = await downloadKnowledgeFile(row.storagePath);
      const bytes = Buffer.from(await file.bytes.arrayBuffer());
      return new Response(bytes, {
        headers: {
          "Content-Type": row.sourceMime || file.contentType,
          "Content-Disposition": `attachment; filename="${row.sourceFilename.replace(/"/g, "")}"`,
        },
      });
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
      status?: "ready" | "failed" | "processing";
      error?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (typeof body.title === "string" && body.title.trim()) {
      patch.title = body.title.trim();
    }
    if (typeof body.markdown === "string") {
      patch.markdown = body.markdown;
      patch.charCount = body.markdown.length;
      patch.status = "ready";
      patch.error = null;
    }
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;

    const [row] = await db
      .update(knowledgeDoc)
      .set(patch)
      .where(eq(knowledgeDoc.id, id))
      .returning();

    if (typeof body.markdown === "string" || typeof body.title === "string") {
      await replaceKnowledgeChunks(db, {
        docId: id,
        title: row!.title,
        markdown: row!.markdown,
      });
    }

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
        status: before.status,
      },
      after: {
        title: row!.title,
        enabled: row!.enabled,
        charCount: row!.charCount,
        status: row!.status,
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
    await deleteKnowledgeFile(before.storagePath);
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
