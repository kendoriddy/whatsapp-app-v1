#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createStubLlmClient, classifyMessage } from "../../packages/ai/src/index.ts";

type Row = { text: string; label: string };

function heuristic(text: string) {
  const t = text.toLowerCase();
  if (/buy|order|polo|qty|size|logo|tees|\d+/.test(t) && !/refund|late|wrong/.test(t)) {
    return { label: "order", confidence: 0.8, rationale: "h" };
  }
  if (/refund|complaint|late|wrong|defect/.test(t)) return { label: "complaint", confidence: 0.8, rationale: "h" };
  if (/crypto|viagra|win free/.test(t)) return { label: "spam", confidence: 0.9, rationale: "h" };
  return { label: "inquiry", confidence: 0.6, rationale: "h" };
}

const lines = readFileSync(join(import.meta.dirname!, "labelled.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as Row);

const llm = createStubLlmClient((user) => heuristic(user));
let correct = 0;
for (const row of lines) {
  const r = await classifyMessage(llm, "stub", row.text, 0.7);
  if (r.output.label === row.label) correct += 1;
}
const acc = correct / lines.length;
const baseline = JSON.parse(readFileSync(join(import.meta.dirname!, "baseline.json"), "utf8")) as { macroF1: number };
console.log({ accuracy: acc, n: lines.length, baseline: baseline.macroF1 });
if (process.argv.includes("--ci") && acc < baseline.macroF1 - 0.02) {
  console.error("CI gate failed");
  process.exit(1);
}
