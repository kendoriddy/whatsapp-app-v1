import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { extractToMarkdown } from "../../apps/web/src/lib/extract-markdown";

describe("extractToMarkdown spreadsheet", () => {
  it("extracts a price-list row into a markdown table", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Product", "Price"],
      ["Staff polo", "8500"],
      ["Cap", "2500"],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Prices");
    const buf = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await extractToMarkdown({
      name: "price-list.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      arrayBuffer: async () =>
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    });

    expect(result.title).toBe("price-list");
    expect(result.markdown).toContain("## Prices");
    expect(result.markdown).toContain("Staff polo");
    expect(result.markdown).toContain("8500");
    expect(result.markdown).toContain("|");
  });
});
