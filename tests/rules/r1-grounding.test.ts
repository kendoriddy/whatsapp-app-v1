import { describe, expect, it } from "vitest";
import { groundField, suggestionContainsUngroundedPrice } from "@mmabon/ai";

describe("R-1 grounding", () => {
  it("r1-no-invented-fabric", () => {
    const r = groundField({
      key: "fabric",
      value: "cotton",
      status: "provisional",
      evidenceTexts: ["need navy polos"],
      evidenceMessageIds: ["m1"],
    });
    expect(r.status).toBe("missing");
    expect(r.error).toBe("GROUNDING_FAILED");
  });

  it("r1-image-not-product", () => {
    const r = groundField(
      {
        key: "product",
        value: "polo",
        status: "provisional",
        evidenceTexts: ["image of a shirt"],
        evidenceMessageIds: ["m1"],
      },
      { fromImageOnly: true },
    );
    expect(r.status).toBe("missing");
  });

  it("r1-grounding-drops-number", () => {
    const r = groundField({
      key: "quantity",
      value: 100,
      status: "provisional",
      evidenceTexts: ["maybe 80 navy"],
      evidenceMessageIds: ["m1"],
    });
    expect(r.value).toBe(80);
  });

  it("r1-suggestion-price-guard", () => {
    expect(suggestionContainsUngroundedPrice("That will be ₦5,000", [])).toBe(true);
    expect(suggestionContainsUngroundedPrice("That will be ₦5,000", ["₦5,000"])).toBe(false);
  });

  it("r1-assumed-requires-rule", () => {
    const r = groundField({
      key: "fit",
      value: "standard",
      status: "assumed",
      evidenceTexts: [],
      evidenceMessageIds: [],
      defaultRuleId: null,
    });
    expect(r.status).toBe("missing");
  });
});
