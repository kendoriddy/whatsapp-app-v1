/**
 * Extract staff uploads into markdown for the Merlin knowledge bank.
 * Supports: md/txt/csv/json/html, docx, pdf, xlsx/xls, pptx, and document photos.
 */

import type { LlmClient } from "@mmabon/ai";

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

async function extractSpreadsheet(buf: Buffer): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
    const parts: string[] = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
        sheet,
        { header: 1, defval: "", raw: false },
      ) as unknown[][];
      if (!rows.length) continue;
      parts.push(`## ${name}`);
      const maxCols = Math.max(
        ...rows.map((r) => (Array.isArray(r) ? r.length : 0)),
        0,
      );
      if (maxCols === 0) continue;
      const asCells = rows.map((r) => {
        const arr = Array.isArray(r) ? r : [];
        return Array.from({ length: maxCols }, (_, i) =>
          String(arr[i] ?? "")
            .replace(/\|/g, "\\|")
            .replace(/\n/g, " ")
            .trim(),
        );
      });
      // Drop fully empty trailing rows
      while (
        asCells.length &&
        asCells[asCells.length - 1]!.every((c) => c === "")
      ) {
        asCells.pop();
      }
      if (!asCells.length) continue;
      const header = asCells[0]!;
      const body = asCells.slice(1);
      parts.push(`| ${header.join(" | ")} |`);
      parts.push(`| ${header.map(() => "---").join(" | ")} |`);
      for (const row of body) {
        if (row.every((c) => c === "")) continue;
        parts.push(`| ${row.join(" | ")} |`);
      }
      parts.push("");
    }
    const markdown = parts.join("\n").trim();
    if (!markdown) throw new Error("Spreadsheet had no readable cells");
    return markdown;
  } catch (e) {
    throw new Error(
      `Spreadsheet extract failed (${String((e as Error).message)}). Upload .xlsx or paste as CSV.`,
    );
  }
}

async function extractPptx(buf: Buffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)/i)?.[1] ?? 0);
        const nb = Number(b.match(/slide(\d+)/i)?.[1] ?? 0);
        return na - nb;
      });
    if (!slideFiles.length) throw new Error("No slides found in PPTX");
    const parts: string[] = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]!]!.async("string");
      const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) =>
        m[1]!
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .trim(),
      );
      const body = texts.filter(Boolean).join("\n");
      if (body) parts.push(`## Slide ${i + 1}\n${body}`);
    }
    const markdown = parts.join("\n\n").trim();
    if (!markdown) throw new Error("No text found in slides");
    return markdown;
  } catch (e) {
    throw new Error(
      `PowerPoint extract failed (${String((e as Error).message)}). Upload .pptx or paste as .md.`,
    );
  }
}

async function extractImageWithLlm(
  buf: Buffer,
  mime: string,
  llm: LlmClient,
  model: string,
): Promise<string> {
  const base64 = buf.toString("base64");
  const result = await llm.completeJson<{ markdown: string }>({
    model,
    system: [
      "You extract business knowledge from a document photo or scan.",
      "Return markdown that preserves headings, lists, tables, prices, and policies.",
      "Do not invent text that is not visible. If unreadable, say so briefly.",
    ].join(" "),
    user: "Extract all readable text from this image into markdown.",
    schemaName: "knowledge_image_extract",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        markdown: { type: "string" },
      },
      required: ["markdown"],
    },
    images: [{ mime, base64 }],
  });
  const markdown = (result.output.markdown || "").trim();
  if (!markdown) throw new Error("No text could be read from this image");
  return markdown;
}

export type ExtractResult = {
  markdown: string;
  title: string;
  mime: string;
};

export type ExtractOptions = {
  /** Required for image OCR */
  llm?: LlmClient;
  visionModel?: string;
};

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function extractToMarkdown(
  file:
    | File
    | { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> },
  opts: ExtractOptions = {},
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
  } else if (
    ext === "xlsx" ||
    ext === "xls" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  ) {
    markdown = await extractSpreadsheet(buf);
  } else if (
    ext === "pptx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    markdown = await extractPptx(buf);
  } else if (IMAGE_EXTS.has(ext) || IMAGE_MIMES.has(mime)) {
    if (!opts.llm) {
      throw new Error(
        "Image uploads need Merlin vision — ensure AI credentials are configured, or upload .md/.pdf/.docx instead.",
      );
    }
    const imageMime =
      mime.startsWith("image/") && mime !== "application/octet-stream"
        ? mime
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "image/jpeg";
    markdown = await extractImageWithLlm(
      buf,
      imageMime,
      opts.llm,
      opts.visionModel || "auto",
    );
  } else if (ext === "doc") {
    throw new Error(
      "Legacy .doc is not supported — save as .docx or paste as .md/.txt.",
    );
  } else if (
    ["zip", "rar", "7z", "tar", "gz", "mp3", "wav", "mp4", "mov", "avi"].includes(
      ext,
    )
  ) {
    throw new Error(
      `Unsupported file type (.${ext}). Upload .md, .txt, .csv, .html, .json, .docx, .pdf, .xlsx, .pptx, or an image of a document.`,
    );
  } else {
    // Last resort: treat as UTF-8 text if it looks printable.
    const asText = buf.toString("utf8");
    const sample = asText.slice(0, 2000);
    const weird = (sample.match(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u024f]/g) || [])
      .length;
    if (weird / Math.max(sample.length, 1) > 0.15) {
      throw new Error(
        `Unsupported file type (.${ext || "unknown"}). Upload .md, .txt, .csv, .html, .json, .docx, .pdf, .xlsx, .pptx, or an image of a document.`,
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
