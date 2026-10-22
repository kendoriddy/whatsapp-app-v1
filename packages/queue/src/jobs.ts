export const Jobs = {
  WA_PROCESS_EVENT: "wa.process_event",
  WA_SEND_OUTBOUND: "wa.send_outbound",
  WA_DOWNLOAD_MEDIA: "wa.download_media",
  AI_CLASSIFY_MESSAGE: "ai.classify_message",
  AI_EXTRACT_BRIEF: "ai.extract_brief",
  AI_SUGGEST_REPLY: "ai.suggest_reply",
  AI_TRANSCRIBE: "ai.transcribe_audio",
  AI_DESCRIBE_IMAGE: "ai.describe_image",
  TEMPLATES_SYNC: "templates.sync",
  PAYSTACK_PROCESS_EVENT: "paystack.process_event",
  FOLLOWUPS_GENERATE: "followups.generate",
  MAINTENANCE_PURGE: "maintenance.purge",
} as const;

export type JobName = (typeof Jobs)[keyof typeof Jobs];

export type WaProcessEventPayload = { webhookEventId: number };
export type WaSendOutboundPayload = { outboundId: string };
export type WaDownloadMediaPayload = { mediaAssetId: string };
export type AiClassifyPayload = { messageId: string };
export type AiConversationPayload = { conversationId: string };
export type PaystackProcessPayload = { webhookEventId: number };
