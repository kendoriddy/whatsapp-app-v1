export const COLOUR_SYNONYMS: Record<string, string[]> = {
  navy: ["navy", "navy blue", "dark blue"],
  burgundy: ["burgundy", "wine", "maroon"],
  white: ["white", "off-white", "ivory"],
  black: ["black"],
};

export function colourMatches(value: string, evidenceText: string): boolean {
  const v = value.toLowerCase().trim();
  const text = evidenceText.toLowerCase();
  if (text.includes(v)) return true;
  for (const syns of Object.values(COLOUR_SYNONYMS)) {
    if (syns.includes(v) && syns.some((s) => text.includes(s))) return true;
  }
  return false;
}
