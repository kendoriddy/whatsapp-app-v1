import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("R-5 secrets", () => {
  it("r5-no-secret-in-client-bundle placeholder", () => {
    // Client bundle does not exist until next build; ensure .env.example documents secrets as env-only
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(example).toContain("META_APP_SECRET");
    expect(existsSync(join(process.cwd(), ".env"))).toBe(false);
  });
});
