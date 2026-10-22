export const BUSINESS_TZ = "Africa/Lagos";

export function windowExpiresAt(lastInboundAt: Date | null): Date | null {
  if (!lastInboundAt) return null;
  return new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000);
}

export function isWindowOpen(
  lastInboundAt: Date | null,
  now: Date,
  safetyMarginSeconds: number,
): boolean {
  if (!lastInboundAt) return false;
  const closesAt = lastInboundAt.getTime() + 24 * 60 * 60 * 1000 - safetyMarginSeconds * 1000;
  return now.getTime() < closesAt;
}

export function formatLagos(d: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: BUSINESS_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
