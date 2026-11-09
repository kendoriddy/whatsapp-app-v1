import { eq, sql } from "drizzle-orm";
import { knowledgeChunk } from "@mmabon/db";
import type { Db } from "@mmabon/db";
import { chunkMarkdown } from "@/lib/chunk-markdown";

/** Replace all searchable chunks for a knowledge document. */
export async function replaceKnowledgeChunks(
  db: Db,
  args: { docId: string; title: string; markdown: string },
): Promise<number> {
  const pieces = chunkMarkdown(args.markdown);
  await db.delete(knowledgeChunk).where(eq(knowledgeChunk.docId, args.docId));
  if (pieces.length === 0) return 0;

  for (let i = 0; i < pieces.length; i++) {
    const body = pieces[i]!;
    await db.execute(sql`
      insert into knowledge_chunk (doc_id, ordinal, markdown, search_vector)
      values (
        ${args.docId}::uuid,
        ${i},
        ${body},
        setweight(to_tsvector('english', ${args.title}), 'A')
          || setweight(to_tsvector('english', ${body}), 'B')
      )
    `);
  }
  return pieces.length;
}
