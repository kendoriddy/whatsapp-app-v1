import { describe, expect, it } from "vitest";
import {
  chunkMarkdown,
  chooseKnowledgeContext,
} from "@mmabon/ai";

describe("chunkMarkdown", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkMarkdown("Hello FAQ")).toEqual(["Hello FAQ"]);
  });

  it("splits long text with overlap so a mid-doc phrase is findable", () => {
    const marker = "UNIQUE_DELIVERY_FEE_IS_2500_NAIRA";
    const head = "A".repeat(2000);
    const tail = "B".repeat(2000);
    const chunks = chunkMarkdown(`${head}\n\n${marker}\n\n${tail}`, {
      size: 1500,
      overlap: 200,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((c) => c.includes(marker))).toBe(true);
  });
});

describe("chooseKnowledgeContext", () => {
  it("returns empty when there are no docs", () => {
    expect(chooseKnowledgeContext({ docs: [], hits: null, budget: 1000 })).toEqual({
      markdown: "",
      mode: "empty",
    });
  });

  it("passes all docs when they fit the budget", () => {
    const docs = [
      { title: "Hours", markdown: "Open Mon–Sat 9–6" },
      { title: "Prices", markdown: "Polo ₦8500" },
    ];
    const result = chooseKnowledgeContext({ docs, hits: null, budget: 28_000 });
    expect(result.mode).toBe("all");
    expect(result.markdown).toContain("Open Mon–Sat 9–6");
    expect(result.markdown).toContain("Polo ₦8500");
  });

  it("prefers matching search hits over newest unrelated docs when bank is large", () => {
    const filler = "x".repeat(20_000);
    const docs = [
      { title: "Newest unrelated", markdown: `${filler} about fabric colours` },
      { title: "Delivery policy", markdown: "Delivery within Lagos is ₦2500." },
    ];
    const hits = [
      { title: "Delivery policy", markdown: "Delivery within Lagos is ₦2500." },
    ];
    const result = chooseKnowledgeContext({
      docs,
      hits,
      budget: 5_000,
    });
    expect(result.mode).toBe("search");
    expect(result.markdown).toContain("Delivery within Lagos is ₦2500");
    expect(result.markdown).not.toContain("fabric colours");
  });
});
