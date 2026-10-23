import { desc, eq } from "drizzle-orm";
import { auditLog, knowledgeDoc } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";
import { extractToMarkdown } from "@/lib/extract-markdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const items = await getDb()
      .select({
        id: knowledgeDoc.id,
        title: knowledgeDoc.title,
        sourceFilename: knowledgeDoc.sourceFilename,
        sourceMime: knowledgeDoc.sourceMime,
        charCount: knowledgeDoc.charCount,
        enabled: knowledgeDoc.enabled,
        createdAt: knowledgeDoc.createdAt,
        updatedAt: knowledgeDoc.updatedAt,
      })
      .from(knowledgeDoc)
      .orderBy(desc(knowledgeDoc.updatedAt));
    return Response.json({ items });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}

/**
 * Create a knowledge doc:
 * - multipart `file` → extract to markdown
 * - JSON `{ title, markdown }` → store pasted markdown directly
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");

    const contentType = req.headers.get("content-type") ?? "";
    let title: string;
    let sourceFilename: string;
    let sourceMime: string;
    let markdown: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const titleOverride = String(form.get("title") ?? "").trim();
      if (!(file instanceof File)) {
        return jsonError("VALIDATION", "file required", 400);
      }
      if (file.size > 12 * 1024 * 1024) {
        return jsonError("VALIDATION", "File too large (max 12MB)", 400);
      }
      let extracted;
      try {
        extracted = await extractToMarkdown(file);
      } catch (err) {
        return jsonError("EXTRACT_FAILED", String((err as Error).message), 422);
      }
      title = titleOverride || extracted.title;
      sourceFilename = file.name;
      sourceMime = extracted.mime || file.type || "application/octet-stream";
      markdown = extracted.markdown;
    } else {
      const body = (await req.json()) as { title?: string; markdown?: string };
      markdown = (body.markdown ?? "").trim();
      if (!markdown) {
        return jsonError("VALIDATION", "markdown required", 400);
      }
      title = (body.title ?? "Untitled note").trim() || "Untitled note";
      sourceFilename = `${title.replace(/[^\w.-]+/g, "_").slice(0, 40)}.md`;
      sourceMime = "text/markdown";
    }

    const db = getDb();
    const [row] = await db
      .insert(knowledgeDoc)
      .values({
        title,
        sourceFilename,
        sourceMime,
        markdown,
        charCount: markdown.length,
        enabled: true,
        createdBy: user.id,
      })
      .returning();

    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "knowledge_doc.create",
      entityType: "knowledge_doc",
      entityId: row!.id,
      after: {
        title: row!.title,
        sourceFilename: row!.sourceFilename,
        charCount: row!.charCount,
      },
    });

    return Response.json(row, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
