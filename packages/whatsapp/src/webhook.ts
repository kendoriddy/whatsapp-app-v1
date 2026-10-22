import { z } from "zod";

const inboundCommon = z
  .object({
    from: z.string(),
    id: z.string(),
    timestamp: z.string(),
    type: z.string(),
    context: z
      .object({ from: z.string().optional(), id: z.string() })
      .optional(),
  })
  .passthrough();

export const metaWebhookSchema = z
  .object({
    object: z.literal("whatsapp_business_account"),
    entry: z.array(
      z
        .object({
          id: z.string(),
          changes: z.array(
            z
              .object({
                field: z.string(),
                value: z.record(z.string(), z.unknown()),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type MetaWebhook = z.infer<typeof metaWebhookSchema>;

export function parseMetaWebhook(body: unknown): MetaWebhook {
  return metaWebhookSchema.parse(body);
}

export function mapInboundType(type: string): string {
  const known = new Set([
    "text",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
    "location",
    "contacts",
    "interactive",
    "button",
    "reaction",
    "unsupported",
  ]);
  return known.has(type) ? type : "unsupported";
}

export function extractTextBody(msg: Record<string, unknown>): string | null {
  const type = String(msg.type ?? "");
  if (type === "text")
    return (msg.text as { body?: string } | undefined)?.body ?? null;
  if (type === "button")
    return (msg.button as { text?: string } | undefined)?.text ?? null;
  if (type === "interactive") {
    const i = msg.interactive as
      | { button_reply?: { title?: string }; list_reply?: { title?: string } }
      | undefined;
    return i?.button_reply?.title ?? i?.list_reply?.title ?? null;
  }
  if (type === "contacts") return "[contact card]";
  return null;
}

export function extractCaption(msg: Record<string, unknown>): string | null {
  const type = String(msg.type ?? "");
  const media = msg[type] as { caption?: string } | undefined;
  return media?.caption ?? null;
}

export { inboundCommon };
