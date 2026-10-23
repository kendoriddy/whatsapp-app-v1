import type { LlmClient } from "../llm.js";

export type InvoiceDraft = {
  description: string | null;
  amount_naira: number | null;
  delivery_naira: number | null;
  /** Suggested deposit percent 1–100 when chat mentions a deposit; else null */
  deposit_percent: number | null;
  /** Delivery / ready-by deadline as YYYY-MM-DD */
  need_by: string | null;
  /** Event / occasion date as YYYY-MM-DD when mentioned */
  event_date: string | null;
  notes: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim().slice(0, 10);
  if (!DATE_RE.test(s)) return null;
  const t = Date.parse(`${s}T12:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return s;
}

function todayInTz(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function draftInvoiceFromThread(
  llm: LlmClient,
  args: {
    model: string;
    messages: Array<{
      direction: "inbound" | "outbound";
      text: string;
      at?: string;
    }>;
    /** IANA tz for resolving relative dates (default Africa/Lagos) */
    timeZone?: string;
  },
): Promise<{
  draft: InvoiceDraft;
  model: string;
  provider: string;
  latencyMs: number;
}> {
  const timeZone = args.timeZone || "Africa/Lagos";
  const today = todayInTz(timeZone);

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
      "You fill a WhatsApp invoice / order form from a sales chat.",
      "Only use amounts, products, and dates clearly stated or agreed in the messages.",
      "amount_naira = goods/subtotal in Nigerian naira (number), not kobo.",
      "delivery_naira = delivery/shipping if mentioned, else null.",
      "description = short product/order summary (max ~120 chars).",
      "deposit_percent = if customer or staff agreed a deposit percentage (e.g. 50%), return that integer; else null.",
      `Today is ${today} (${timeZone}). Resolve relative dates (e.g. "Friday", "next week", "by the 30th") to YYYY-MM-DD.`,
      "need_by = when goods must be ready / delivered / collected (deadline). null if not stated.",
      "event_date = date of the event/occasion (wedding, launch, etc.) when mentioned. null if not stated.",
      "If only one date is given and it is clearly a deadline, put it in need_by (and event_date only if also an event).",
      "Do not invent prices or dates. If unknown, return null for that field.",
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
        need_by: { type: ["string", "null"] },
        event_date: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
      required: [
        "description",
        "amount_naira",
        "delivery_naira",
        "deposit_percent",
        "need_by",
        "event_date",
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
      need_by: normalizeDate(d.need_by),
      event_date: normalizeDate(d.event_date),
      notes: d.notes?.trim() || null,
    },
    model: result.model,
    provider: result.provider,
    latencyMs: result.latencyMs,
  };
}
