import { createMemoryQueue } from "@mmabon/queue";
import { processWaEvent } from "../../../worker/src/handlers/process-event";
import { handleSendOutbound } from "../../../worker/src/handlers/send-outbound";
import { processPaystackEvent } from "../../../worker/src/handlers/process-paystack";
import { getDb } from "./db";

/** Process ingest in-request so inbox works when the background worker is down. */
export async function processWebhookInline(
  webhookEventId: number,
): Promise<void> {
  await processWaEvent(getDb(), createMemoryQueue(), webhookEventId);
}

/** Send via Graph in-request so staff replies work without a separate worker. */
export async function sendOutboundInline(outboundId: string): Promise<void> {
  await handleSendOutbound(getDb(), outboundId);
}

/** Confirm Paystack payments in-request when the worker is down. */
export async function processPaystackInline(
  webhookEventId: number,
): Promise<void> {
  await processPaystackEvent(getDb(), webhookEventId);
}
