import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseMetaWebhook } from "@mmabon/whatsapp";

describe("AC-WH-6 contract fixtures", () => {
  const dir = join(process.cwd(), "fixtures/meta-payloads");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("parses all meta-payloads", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
      expect(() => parseMetaWebhook(raw)).not.toThrow();
    }
  });
});
