import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { auditLog, knowledgeDoc } from "@mmabon/db";
import { createGatewayLlmClient } from "@mmabon/ai";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";
import { extractToMarkdown } from "@/lib/extract-markdown";
import { replaceKnowledgeChunks } from "@/lib/knowledge-chunks";
import {
  deleteKnowledgeFile,
  uploadKnowledgeFile,
} from "@/lib/knowledge-storage";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function visionLlm() {
  const env = getEnv();
  return createGatewayLlmClient({
    primary: env.AI_PRIMARY_PROVIDER,
    cencoriApiKey: env.CENCORI_API_KEY,
    llmApiKey: env.LLM_API_KEY,
    llmBaseUrl: env.LLM_BASE_URL,
    geminiApiKey: env.GEMINI_API_KEY,
    openaiFallbackModel: env.AI_OPENAI_FALLBACK_MODEL,
    geminiFallbackModel: env.AI_GEMINI_FALLBACK_MODEL,
  });
}

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
        status: knowledgeDoc.status,
        error: knowledgeDoc.error,
        storagePath: knowledgeDoc.storagePath,
        byteSize: knowledgeDoc.byteSize,
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
 * - multipart `file` (or repeated `files`) → extract to markdown + store original
 * - JSON `{ title, markdown }` → store pasted markdown directly
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");

    const contentType = req.headers.get("content-type") ?? "";
    const db = getDb();

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const titleOverride = String(form.get("title") ?? "").trim();
      const files: File[] = [];
      for (const value of form.getAll("file")) {
        if (value instanceof File) files.push(value);
      }
      for (const value of form.getAll("files")) {
        if (value instanceof File) files.push(value);
      }
      if (!files.length) {
        return jsonError("VALIDATION", "file required", 400);
      }

      const created: unknown[] = [];
      const errors: { filename: string; message: string }[] = [];

      for (const file of files) {
        if (file.size > 12 * 1024 * 1024) {
          errors.push({
            filename: file.name,
            message: "File too large (max 12MB)",
          });
          continue;
        }

        const docId = randomUUID();
        let storagePath: string | null = null;
        try {
          const bytes = Buffer.from(await file.arrayBuffer());
          storagePath = await uploadKnowledgeFile({
            docId,
            filename: file.name,
            mime: file.type || "application/octet-stream",
            bytes,
          });

          await db.insert(knowledgeDoc).values({
            id: docId,
            title:
              titleOverride ||
              file.name.replace(/\.[^.]+$/, "") ||
              "Untitled",
            sourceFilename: file.name,
            sourceMime: file.type || "application/octet-stream",
            markdown: "",
            charCount: 0,
            enabled: true,
            status: "processing",
            storagePath,
            byteSize: file.size,
            createdBy: user.id,
          });

          let extracted;
          try {
            extracted = await extractToMarkdown(
              {
                name: file.name,
                type: file.type,
                arrayBuffer: async () =>
                  bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                  ) as ArrayBuffer,
              },
              {
                llm: visionLlm(),
                visionModel:
                  getEnv().AI_SUGGEST_MODEL ||
                  getEnv().AI_SUMMARY_MODEL ||
                  "auto",
              },
            );
          } catch (err) {
            await db
              .update(knowledgeDoc)
              .set({
                status: "failed",
                error: String((err as Error).message),
                updatedAt: new Date(),
              })
              .where(eq(knowledgeDoc.id, docId));
            errors.push({
              filename: file.name,
              message: String((err as Error).message),
            });
            continue;
          }

          const title = titleOverride || extracted.title;
          const [row] = await db
            .update(knowledgeDoc)
            .set({
              title,
              sourceMime:
                extracted.mime || file.type || "application/octet-stream",
              markdown: extracted.markdown,
              charCount: extracted.markdown.length,
              status: "ready",
              error: null,
              updatedAt: new Date(),
            })
            .where(eq(knowledgeDoc.id, docId))
            .returning();

          await replaceKnowledgeChunks(db, {
            docId,
            title,
            markdown: extracted.markdown,
          });

          await db.insert(auditLog).values({
            actorKind: "staff",
            actorId: user.id,
            action: "knowledge_doc.create",
            entityType: "knowledge_doc",
            entityId: docId,
            after: {
              title: row!.title,
              sourceFilename: row!.sourceFilename,
              charCount: row!.charCount,
              status: row!.status,
            },
          });

          created.push(row);
        } catch (err) {
          if (storagePath) await deleteKnowledgeFile(storagePath);
          errors.push({
            filename: file.name,
            message: String((err as Error).message),
          });
        }
      }

      if (!created.length) {
        return jsonError(
          "EXTRACT_FAILED",
          errors[0]?.message ?? "Upload failed",
          422,
        );
      }

      return Response.json(
        {
          items: created,
          errors,
          title: (created[0] as { title?: string })?.title,
        },
        { status: 201 },
      );
    }

    const body = (await req.json()) as { title?: string; markdown?: string };
    const markdown = (body.markdown ?? "").trim();
    if (!markdown) {
      return jsonError("VALIDATION", "markdown required", 400);
    }
    const title = (body.title ?? "Untitled note").trim() || "Untitled note";
    const sourceFilename = `${title.replace(/[^\w.-]+/g, "_").slice(0, 40)}.md`;

    const [row] = await db
      .insert(knowledgeDoc)
      .values({
        title,
        sourceFilename,
        sourceMime: "text/markdown",
        markdown,
        charCount: markdown.length,
        enabled: true,
        status: "ready",
        byteSize: Buffer.byteLength(markdown, "utf8"),
        createdBy: user.id,
      })
      .returning();

    await replaceKnowledgeChunks(db, {
      docId: row!.id,
      title,
      markdown,
    });

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
        status: row!.status,
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
