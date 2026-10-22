import { describe, expect, it } from "vitest";
import { assertTransition } from "@mmabon/domain";

describe("orders AI transitions", () => {
  it("orders-ai-cannot-confirm", () => {
    expect(() => assertTransition("quoted", "confirmed", "ai")).toThrow(
      /confirmed\/paid\/fulfilled|AI_TRANSITION_FORBIDDEN/,
    );
    expect(() =>
      assertTransition("quoted", "confirmed", "staff"),
    ).not.toThrow();
  });
});
