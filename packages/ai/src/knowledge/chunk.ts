/** Split markdown into overlapping chunks for full-text retrieval. */

export const KNOWLEDGE_CHUNK_SIZE = 1_500;
export const KNOWLEDGE_CHUNK_OVERLAP = 200;

export function chunkMarkdown(
  markdown: string,
  opts?: { size?: number; overlap?: number },
): string[] {
  const size = opts?.size ?? KNOWLEDGE_CHUNK_SIZE;
  const overlap = opts?.overlap ?? KNOWLEDGE_CHUNK_OVERLAP;
  const text = markdown.trim();
  if (!text) return [];
  if (text.length <= size) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const para = window.lastIndexOf("\n\n");
      const sentence = window.lastIndexOf(". ");
      const breakAt = Math.max(para, sentence > size * 0.4 ? sentence + 1 : -1);
      if (breakAt > size * 0.4) {
        end = start + breakAt + 1;
      }
    }
    const slice = text.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
    if (start >= end) start = end;
  }
  return chunks;
}

export type KnowledgeDocPiece = { title: string; markdown: string };

/** Pack titled pieces into a prompt budget (newest / highest-ranked first). */
export function packKnowledgePieces(
  pieces: KnowledgeDocPiece[],
  budget: number,
): string {
  let knowledge = "";
  for (const d of pieces) {
    const chunk = `### ${d.title}\n${d.markdown}\n\n`;
    if (knowledge.length + chunk.length > budget) break;
    knowledge += chunk;
  }
  return knowledge.trim();
}

/**
 * Choose Merlin context: all docs when they fit; otherwise prefer search hits.
 * Used by the worker and covered by unit tests without a live database.
 */
export function chooseKnowledgeContext(args: {
  docs: KnowledgeDocPiece[];
  hits: KnowledgeDocPiece[] | null;
  budget: number;
}): { markdown: string; mode: "all" | "search" | "empty" } {
  const { docs, hits, budget } = args;
  if (!docs.length) return { markdown: "", mode: "empty" };
  const totalChars = docs.reduce(
    (n, d) => n + d.title.length + d.markdown.length + 8,
    0,
  );
  if (totalChars <= budget) {
    return { markdown: packKnowledgePieces(docs, budget), mode: "all" };
  }
  if (hits?.length) {
    return { markdown: packKnowledgePieces(hits, budget), mode: "search" };
  }
  return { markdown: packKnowledgePieces(docs, budget), mode: "all" };
}
