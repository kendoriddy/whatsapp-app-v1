/** Pure preconditions for Merlin auto-answer (unit-tested). */

export function shouldAttemptMerlinReply(args: {
  autoEnabled: boolean;
  featureFlagEnabled: boolean | null | undefined;
  direction: string;
  classification: string | null | undefined;
  skipSpam: boolean;
  windowOpen: boolean;
}): boolean {
  if (!args.autoEnabled) return false;
  if (args.featureFlagEnabled === false) return false;
  if (args.direction !== "inbound") return false;
  if (args.skipSpam && args.classification === "spam") return false;
  if (!args.windowOpen) return false;
  return true;
}
