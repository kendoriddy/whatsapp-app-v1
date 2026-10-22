import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signMetaPayload(rawBody: Buffer | string, appSecret: string): string {
  const buf = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
  return `sha256=${createHmac("sha256", appSecret).update(buf).digest("hex")}`;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function dedupeKeyFromBody(rawBody: Buffer): string {
  return createHmac("sha256", "dedupe").update(rawBody).digest("hex");
}
