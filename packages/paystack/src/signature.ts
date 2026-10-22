import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaystackSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const PAYSTACK_IPS = ["52.31.139.75", "52.49.173.169", "52.214.14.220"] as const;
