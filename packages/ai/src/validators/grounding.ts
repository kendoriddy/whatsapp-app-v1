import { colourMatches } from "@mmabon/domain";
import { ErrorCodes } from "@mmabon/shared";

export type FieldCandidate = {
  key: string;
  value: unknown;
  status: "confirmed" | "provisional" | "assumed" | "missing";
  evidenceTexts: string[];
  evidenceMessageIds: string[];
  defaultRuleId?: string | null;
};

export type GroundingResult = {
  value: unknown;
  status: FieldCandidate["status"];
  evidenceMessageIds: string[];
  defaultRuleId?: string | null;
  error?: string;
};

/**
 * R-1 grounding: drop ungrounded values; images never set product attributes.
 */
export function groundField(candidate: FieldCandidate, opts?: { fromImageOnly?: boolean }): GroundingResult {
  if (opts?.fromImageOnly && ["product", "fabric", "colour", "decoration", "quantity", "size", "price"].includes(candidate.key)) {
    return { value: null, status: "missing", evidenceMessageIds: [], error: ErrorCodes.GROUNDING_FAILED };
  }

  if (candidate.status === "assumed") {
    if (!candidate.defaultRuleId) {
      return { value: null, status: "missing", evidenceMessageIds: [], error: ErrorCodes.GROUNDING_FAILED };
    }
    return {
      value: candidate.value,
      status: "assumed",
      evidenceMessageIds: candidate.evidenceMessageIds,
      defaultRuleId: candidate.defaultRuleId,
    };
  }

  if (candidate.status === "missing" || candidate.value == null) {
    return { value: null, status: "missing", evidenceMessageIds: [] };
  }

  if (candidate.evidenceMessageIds.length === 0 || candidate.evidenceTexts.length === 0) {
    return { value: null, status: "missing", evidenceMessageIds: [], error: ErrorCodes.GROUNDING_FAILED };
  }

  const joined = candidate.evidenceTexts.join(" ");
  const v = candidate.value;

  if (typeof v === "number") {
    const nums = joined.match(/\d+/g)?.map(Number) ?? [];
    if (!nums.includes(v)) {
      // prefer evidence number if present
      if (nums.length === 1) {
        return { value: nums[0], status: "provisional", evidenceMessageIds: candidate.evidenceMessageIds };
      }
      return { value: null, status: "missing", evidenceMessageIds: [], error: ErrorCodes.GROUNDING_FAILED };
    }
  } else if (typeof v === "string") {
    const ok =
      candidate.key === "colour"
        ? colourMatches(v, joined)
        : joined.toLowerCase().includes(v.toLowerCase());
    if (!ok) {
      return { value: null, status: "missing", evidenceMessageIds: [], error: ErrorCodes.GROUNDING_FAILED };
    }
  }

  return {
    value: candidate.value,
    status: candidate.status === "confirmed" ? "provisional" : candidate.status,
    evidenceMessageIds: candidate.evidenceMessageIds,
  };
}

const PRICE_RE = /₦\s?[\d,]+|\bNGN\s?[\d,]+|\b\d[\d,]*\s?naira\b/i;

export function suggestionContainsUngroundedPrice(text: string, allowedAmounts: string[]): boolean {
  if (!PRICE_RE.test(text)) return false;
  return !allowedAmounts.some((a) => text.includes(a));
}
