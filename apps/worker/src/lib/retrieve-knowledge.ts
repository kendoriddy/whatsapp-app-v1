import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import { knowledgeDoc } from "@mmabon/db";
import { chooseKnowledgeContext } from "@mmabon/ai";

export const KNOWLEDGE_BUDGET = 28_000;

/**
 * Build Merlin's knowledge context.
 * Small banks: pass every enabled ready document.
 * Larger banks: full-text search chunks for the customer message.
 */
export async function retrieveKnowledgeMarkdown(
  db: Db,
  args: { query: string; budget?: number },
): Promise<{ markdown: string; mode: "all" | "search" | "empty" }> {
  const budget = args.budget ?? KNOWLEDGE_BUDGET;

  const docs = await db
    .select({
      title: knowledgeDoc.title,
      markdown: knowledgeDoc.markdown,
    })
    .from(knowledgeDoc)
    .where(
      and(eq(knowledgeDoc.enabled, true), eq(knowledgeDoc.status, "ready")),
    )
    .orderBy(desc(knowledgeDoc.updatedAt))
    .limit(40);

  if (!docs.length) return { markdown: "", mode: "empty" };

  const totalChars = docs.reduce(
    (n, d) => n + d.title.length + d.markdown.length + 8,
    0,
  );
  if (totalChars <= budget) {
    return chooseKnowledgeContext({ docs, hits: null, budget });
  }

  const query = args.query.trim();
  if (!query) {
    return chooseKnowledgeContext({ docs, hits: null, budget });
  }

  const rows = await db.execute<{
    title: string;
    markdown: string;
    rank: number;
  }>(sql`
    select d.title as title,
           c.markdown as markdown,
           ts_rank(c.search_vector, plainto_tsquery('english', ${query})) as rank
    from knowledge_chunk c
    inner join knowledge_doc d on d.id = c.doc_id
    where d.enabled = true
      and d.status = 'ready'
      and c.search_vector @@ plainto_tsquery('english', ${query})
    order by rank desc, c.ordinal asc
    limit 24
  `);

  const hits = Array.isArray(rows)
    ? [...rows]
    : ((rows as { rows?: { title: string; markdown: string; rank: number }[] })
        .rows ?? []);

  if (!hits.length) {
    return chooseKnowledgeContext({ docs, hits: null, budget });
  }

  const seen = new Set<string>();
  const packed: { title: string; markdown: string }[] = [];
  for (const h of hits) {
    const key = `${h.title}::${h.markdown.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    packed.push({ title: h.title, markdown: h.markdown });
  }

  return chooseKnowledgeContext({ docs, hits: packed, budget });
}
