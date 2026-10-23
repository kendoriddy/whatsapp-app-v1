import type { LlmClient } from "../llm.js";

export type InvoiceDraft = {
  description: string | null;
  amount_naira: number | null;
  delivery_naira: number | null;
  /** Suggested deposit percent 1–100 when chat mentions a deposit; else null */
  deposit_percent: number | null;
  notes: string | null;
};

export async function draftInvoiceFromThread(
  llm: LlmClient,
  args: {
    model: string;
    messages: Array<{
      direction: "inbound" | "outbound";
      text: string;
      at?: string;
    }>;
  },
): Promise<{
  draft: InvoiceDraft;
  model: string;
  provider: string;
  latencyMs: number;
}> {
  const transcript = args.messages
    .map((m) => {
      const who = m.direction === "inbound" ? "Customer" : "Staff";
      const when = m.at ? ` (${m.at})` : "";
      return `${who}${when}: ${m.text}`;
    })
    .join("\n");

  const result = await llm.completeJson<InvoiceDraft>({
    model: args.model,
    system: [
      "You fill a WhatsApp invoice form from a sales chat.",
      "Only use amounts and product details clearly stated or agreed in the messages.",
      "amount_naira = goods/subtotal in Nigerian naira (number), not kobo.",
      "delivery_naira = delivery/shipping if mentioned, else null.",
      "description = short product/order summary (max ~120 chars).",
      "deposit_percent = if customer or staff agreed a deposit percentage (e.g. 50%), return that integer; else null.",
      "Do not invent prices. If unknown, return null for that field.",
      "notes = brief caveat if anything is unclear.",
    ].join(" "),
    user: transcript || "(no messages)",
    schemaName: "invoice_draft",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: { type: ["string", "null"] },
        amount_naira: { type: ["number", "null"] },
        delivery_naira: { type: ["number", "null"] },
        deposit_percent: { type: ["number", "null"] },
        notes: { type: ["string", "null"] },
      },
      required: [
        "description",
        "amount_naira",
        "delivery_naira",
        "deposit_percent",
        "notes",
      ],
    },
  });

  const d = result.output;
  return {
    draft: {
      description: d.description?.trim() || null,
      amount_naira:
        typeof d.amount_naira === "number" && d.amount_naira > 0
          ? d.amount_naira
          : null,
      delivery_naira:
        typeof d.delivery_naira === "number" && d.delivery_naira >= 0
          ? d.delivery_naira
          : null,
      deposit_percent:
        typeof d.deposit_percent === "number" &&
        d.deposit_percent > 0 &&
        d.deposit_percent <= 100
          ? Math.round(d.deposit_percent)
          : null,
      notes: d.notes?.trim() || null,
    },
    model: result.model,
    provider: result.provider,
    latencyMs: result.latencyMs,
  };
}
