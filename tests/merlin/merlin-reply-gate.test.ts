import { describe, expect, it } from "vitest";
import { createStubLlmClient, merlinAutoReply } from "@mmabon/ai";
import { shouldAttemptMerlinReply } from "../../apps/worker/src/lib/merlin-gate";

describe("shouldAttemptMerlinReply", () => {
  const base = {
    autoEnabled: true,
    featureFlagEnabled: true,
    direction: "inbound",
    classification: "inquiry" as string | null,
    skipSpam: true,
    windowOpen: true,
  };

  it("returns false when the admin toggle is off", () => {
    expect(shouldAttemptMerlinReply({ ...base, autoEnabled: false })).toBe(
      false,
    );
  });

  it("returns false for spam when skipSpam is on", () => {
    expect(
      shouldAttemptMerlinReply({ ...base, classification: "spam" }),
    ).toBe(false);
  });

  it("returns false when the 24h window is closed", () => {
    expect(shouldAttemptMerlinReply({ ...base, windowOpen: false })).toBe(
      false,
    );
  });

  it("returns true for an inbound inquiry with toggle on", () => {
    expect(shouldAttemptMerlinReply(base)).toBe(true);
  });
});

describe("merlinAutoReply gating", () => {
  it("does not reply when requireKnowledge and the bank is empty", async () => {
    const llm = createStubLlmClient(() => {
      throw new Error("LLM should not be called");
    });
    const result = await merlinAutoReply(llm, {
      model: "stub",
      conversationText: "Customer: How much for a polo?",
      knowledgeMarkdown: "",
      requireKnowledge: true,
    });
    expect(result.shouldReply).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.reason).toBe("no_knowledge");
  });

  it("does not send when the model declines a decision-needed question", async () => {
    const llm = createStubLlmClient(() => ({
      should_reply: false,
      reply: null,
      reason: "needs_human_quote",
    }));
    const result = await merlinAutoReply(llm, {
      model: "stub",
      conversationText: "Customer: Can you do 200 custom shirts by Friday?",
      knowledgeMarkdown: "### Hours\nOpen 9–6",
      requireKnowledge: true,
    });
    expect(result.shouldReply).toBe(false);
    expect(result.reply).toBeNull();
  });

  it("returns a reply when the model answers from the knowledge bank", async () => {
    const llm = createStubLlmClient(() => ({
      should_reply: true,
      reply: "Yes — delivery within Lagos is ₦2,500.",
      reason: "covered_by_knowledge",
    }));
    const result = await merlinAutoReply(llm, {
      model: "stub",
      conversationText: "Customer: How much is delivery in Lagos?",
      knowledgeMarkdown: "### Delivery\nDelivery within Lagos is ₦2500.",
      requireKnowledge: true,
    });
    expect(result.shouldReply).toBe(true);
    expect(result.reply).toContain("₦2,500");
  });
});
