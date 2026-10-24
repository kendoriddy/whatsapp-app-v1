/**
 * Extract staff uploads into markdown for the Merlin knowledge bank.
 * Supports: md/txt/csv/json/html, docx (mammoth), pdf (pdf-parse).
 */

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<h1[^>]*>/gi, "# ")
    .replace(/<h2[^>]*>/gi, "## ")
    .replace(/<h3[^>]*>/gi, "### ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

async function extractDocx(buf: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    // mammoth has convertToHtml / extractRawText — not convertToMarkdown
    const result = await mammoth.convertToHtml({ buffer: buf });
    return htmlToMarkdown(result.value || "");
  } catch (e) {
    throw new Error(
      `DOCX extract failed (${String((e as Error).message)}). Install mammoth or upload .md/.txt.`,
    );
  }
}

async function extractPdf(buf: Buffer): Promise<string> {
  try {
    // pdf-parse v2 exports differently across builds — try both shapes.
    const mod = (await import("pdf-parse")) as {
      default?: (b: Buffer) => Promise<{ text: string }>;
      PDFParse?: new (opts: { data: Buffer }) => {
        getText: () => Promise<{ text: string }>;
      };
    };
    if (typeof mod.default === "function") {
      const result = await mod.default(buf);
      return (result.text || "").trim();
    }
    if (mod.PDFParse) {
      const parser = new mod.PDFParse({ data: buf });
      const result = await parser.getText();
      return (result.text || "").trim();
    }
    throw new Error("pdf-parse API not recognised");
  } catch (e) {
    throw new Error(
      `PDF extract failed (${String((e as Error).message)}). Install pdf-parse or upload .md/.txt.`,
    );
  }
}

export type ExtractResult = {
  markdown: string;
  title: string;
  mime: string;
};

export async function extractToMarkdown(
  file:
    | File
    | { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> },
): Promise<ExtractResult> {
  const filename = file.name || "document";
  const mime = file.type || "application/octet-stream";
  const ext = extOf(filename);
  const buf = Buffer.from(await file.arrayBuffer());
  const titleGuess = filename.replace(/\.[^.]+$/, "").trim() || "Untitled";

  let markdown = "";

  if (
    ext === "md" ||
    ext === "markdown" ||
    mime === "text/markdown" ||
    mime === "text/x-markdown"
  ) {
    markdown = buf.toString("utf8").trim();
  } else if (
    ext === "txt" ||
    ext === "csv" ||
    ext === "tsv" ||
    ext === "log" ||
    mime.startsWith("text/")
  ) {
    const raw = buf.toString("utf8").trim();
    markdown =
      ext === "csv" || ext === "tsv" ? "```csv\n" + raw + "\n```" : raw;
  } else if (ext === "json" || mime === "application/json") {
    try {
      const parsed = JSON.parse(buf.toString("utf8"));
      markdown = "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
    } catch {
      markdown = buf.toString("utf8").trim();
    }
  } else if (ext === "html" || ext === "htm" || mime === "text/html") {
    markdown = htmlToMarkdown(buf.toString("utf8"));
  } else if (
    ext === "docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    markdown = await extractDocx(buf);
  } else if (ext === "pdf" || mime === "application/pdf") {
    markdown = await extractPdf(buf);
  } else if (ext === "doc") {
    throw new Error(
      "Legacy .doc is not supported — save as .docx or paste as .md/.txt.",
    );
  } else {
    // Last resort: treat as UTF-8 text if it looks printable.
    const asText = buf.toString("utf8");
    const sample = asText.slice(0, 2000);
    const weird = (sample.match(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u024f]/g) || [])
      .length;
    if (weird / Math.max(sample.length, 1) > 0.15) {
      throw new Error(
        `Unsupported file type (.${ext || "unknown"}). Upload .md, .txt, .csv, .html, .json, .docx, or .pdf.`,
      );
    }
    markdown = asText.trim();
  }

  if (!markdown) {
    throw new Error("No text could be extracted from this file.");
  }

  // Soft cap so prompts stay manageable.
  const MAX = 120_000;
  if (markdown.length > MAX) {
    markdown =
      markdown.slice(0, MAX) +
      "\n\n<!-- truncated: original longer than " +
      MAX +
      " chars -->";
  }

  return { markdown, title: titleGuess, mime };
}
