#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createStubLlmClient, extractBrief } from "../../packages/ai/src/index.ts";

const gold = JSON.parse(readFileSync(join(import.meta.dirname!, "gold/A_scattered.json"), "utf8"));
const llm = createStubLlmClient(() => ({
  fields: [
    { key: "product", value: "polo", status: "provisional", evidenceMessageIds: ["m1"] },
    { key: "quantity", value: 80, status: "provisional", evidenceMessageIds: ["m2"] },
    { key: "colour", value: "navy", status: "provisional", evidenceMessageIds: ["m2"] },
    { key: "fabric", value: "silk", status: "provisional", evidenceMessageIds: ["m1"] },
  ],
}));

const r = await extractBrief(
  llm,
  "stub",
  "polos for staff\nmaybe 80, navy",
  { m1: "polos for staff", m2: "maybe 80, navy" },
);
const fabric = r.fields.find((f) => f.key === "fabric");
console.log({ fields: r.fields, fabricDropped: fabric?.status === "missing", gold });
if (fabric?.status !== "missing") {
  console.error("fabric should be missing (ungrounded)");
  process.exit(1);
}
