const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
};

export function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "bin";
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (MIME_EXT[base]) return MIME_EXT[base]!;
  const subtype = base.split("/")[1];
  if (!subtype) return "bin";
  return subtype.replace(/[^a-z0-9]+/gi, "").slice(0, 8) || "bin";
}

export function buildMediaStoragePath(args: {
  conversationId: string;
  mediaAssetId: string;
  mimeType: string | null | undefined;
  now?: Date;
}): string {
  const d = args.now ?? new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ext = extFromMime(args.mimeType);
  return `${yyyy}/${mm}/${args.conversationId}/${args.mediaAssetId}.${ext}`;
}

export function defaultMediaFilename(
  type: string,
  mimeType: string | null | undefined,
  filename?: string | null,
): string | null {
  if (filename?.trim()) return filename.trim().slice(0, 255);
  const ext = extFromMime(mimeType);
  if (type === "document") return `document.${ext}`;
  if (type === "image" || type === "sticker") return `${type}.${ext}`;
  if (type === "audio") return `audio.${ext}`;
  if (type === "video") return `video.${ext}`;
  return null;
}

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
