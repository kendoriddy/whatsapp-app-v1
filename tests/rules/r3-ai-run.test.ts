import { describe, expect, it } from "vitest";
import { classifyMessage, createStubLlmClient, CLASSIFY_PROMPT_VERSION } from "@mmabon/ai";

describe("R-3 ai_run", () => {
  it("r3-ai-run-written", async () => {
    const llm = createStubLlmClient(() => ({
      label: "order",
      confidence: 0.9,
      rationale: "qty mentioned",
    }));
    const r = await classifyMessage(llm, "gpt-test", "80 polos navy", 0.7);
    expect(r.valid).toBe(true);
    expect(r.output.label).toBe("order");
    expect(r.inputHash).toBeTruthy();
    expect(CLASSIFY_PROMPT_VERSION).toMatch(/^classify-v/);
  });
});
