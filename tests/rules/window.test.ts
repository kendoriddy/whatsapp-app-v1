import { describe, expect, it } from "vitest";
import { isWindowOpen } from "@mmabon/shared";

describe("AC-WIN window", () => {
  it("AC-WIN-1 closed when no inbound", () => {
    expect(isWindowOpen(null, new Date(), 300)).toBe(false);
  });

  it("AC-WIN-2 margin closes early", () => {
    const last = new Date(Date.now() - (24 * 60 * 60 * 1000 - 200_000));
    expect(isWindowOpen(last, new Date(), 300)).toBe(false);
  });

  it("open inside window", () => {
    const last = new Date(Date.now() - 60_000);
    expect(isWindowOpen(last, new Date(), 300)).toBe(true);
  });
});
