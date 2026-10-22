import { isWindowOpen, windowExpiresAt } from "@mmabon/shared";

export { isWindowOpen, windowExpiresAt };

export function assertWindowOpen(
  lastInboundAt: Date | null,
  now: Date,
  safetyMarginSeconds: number,
): void {
  if (!isWindowOpen(lastInboundAt, now, safetyMarginSeconds)) {
    const err = new Error("WINDOW_CLOSED");
    err.name = "WINDOW_CLOSED";
    throw err;
  }
}
