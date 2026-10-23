import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  jsonb,
  numeric,
  date,
  bigserial,
  uniqueIndex,
  index,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appRole = pgEnum("app_role", ["admin", "sales", "designer", "production", "dispatch", "manager"]);
export const msgDirection = pgEnum("msg_direction", ["inbound", "outbound"]);
export const msgType = pgEnum("msg_type", [
  "text", "image", "audio", "video", "document", "sticker", "location",
  "contacts", "interactive", "button", "reaction", "template", "unsupported",
]);
export const msgStatus = pgEnum("msg_status", ["received", "accepted", "sent", "delivered", "read", "failed"]);
export const msgClass = pgEnum("msg_class", ["inquiry", "complaint", "order", "spam"]);
export const conversationStatus = pgEnum("conversation_status", ["open", "snoozed", "closed"]);
export const mediaStatus = pgEnum("media_status", ["pending", "downloading", "stored", "failed", "expired"]);
export const outboundKind = pgEnum("outbound_kind", ["text", "media", "template"]);
export const outboundOrigin = pgEnum("outbound_origin", [
  "staff_composed", "ai_suggestion", "followup", "quote", "payment_link", "system_auto",
]);
export const outboundStatus = pgEnum("outbound_status", [
  "draft", "pending_approval", "approved", "rejected", "sending", "sent", "failed", "cancelled",
]);
export const webhookSource = pgEnum("webhook_source", ["meta", "paystack"]);
export const templateStatus = pgEnum("template_status", [
  "APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED", "IN_APPEAL", "LIMIT_EXCEEDED", "UNKNOWN",
]);
export const templateCategory = pgEnum("template_category", ["MARKETING", "UTILITY", "AUTHENTICATION"]);
export const orderStage = pgEnum("order_stage", [
  "new_enquiry", "awaiting_details", "quoted", "negotiating", "confirmed",
  "paid", "in_production", "fulfilled", "lost",
]);
export const waitingOn = pgEnum("waiting_on", [
  "none", "customer_details", "customer_decision", "customer_approval", "internal",
]);
export const fieldStatus = pgEnum("field_status", ["confirmed", "provisional", "assumed", "missing"]);
export const setBy = pgEnum("set_by", ["ai", "staff", "rule"]);
export const riskLevel = pgEnum("risk_level", ["ok", "watch", "at_risk", "late", "unknown"]);
export const changeKind = pgEnum("change_kind", [
  "brief_created", "field_change", "line_item_added", "line_item_removed",
  "variant_change", "stage_change", "quote_created", "quote_superseded",
  "payment", "substitution", "note",
]);
export const actorKind = pgEnum("actor_kind", ["staff", "ai", "system", "customer"]);
export const quoteStatus = pgEnum("quote_status", ["draft", "sent", "accepted", "rejected", "expired", "superseded"]);
export const paymentKind = pgEnum("payment_kind", ["deposit", "balance", "full"]);
export const paymentStatus = pgEnum("payment_status", [
  "created", "link_sent", "paid", "failed", "abandoned", "amount_mismatch", "cancelled",
]);
export const followupReason = pgEnum("followup_reason", [
  "awaiting_details", "quote_no_reply", "artwork_approval", "balance_due", "pickup", "feedback", "manual",
]);
export const followupStatus = pgEnum("followup_status", ["open", "done", "snoozed", "dismissed"]);
export const clarifStatus = pgEnum("clarif_status", ["open", "asked", "answered", "dismissed"]);
export const waPhoneLifecycle = pgEnum("wa_phone_lifecycle", ["pending", "connected", "retired"]);

export const staffUser = pgTable("staff_user", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  role: appRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waPhoneNumber = pgTable(
  "wa_phone_number",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneNumberId: text("phone_number_id").notNull().unique(),
    displayPhoneNumber: text("display_phone_number").notNull(),
    wabaId: text("waba_id").notNull(),
    label: text("label").notNull(),
    lifecycle: waPhoneLifecycle("lifecycle").notNull().default("pending"),
    isActive: boolean("is_active").notNull().default(false),
    verifiedName: text("verified_name"),
    nameStatus: text("name_status"),
    codeVerificationStatus: text("code_verification_status"),
    qualityRating: text("quality_rating"),
    messagingLimitTier: text("messaging_limit_tier"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wa_phone_number_one_active").on(t.isActive).where(sql`${t.isActive} = true`)],
);

export const contact = pgTable("contact", {
  id: uuid("id").primaryKey().defaultRandom(),
  waId: text("wa_id").notNull().unique(),
  e164: text("e164").notNull(),
  profileName: text("profile_name"),
  displayName: text("display_name"),
  email: text("email"),
  notes: text("notes"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contact.id),
    waPhoneNumberId: uuid("wa_phone_number_id").notNull().references(() => waPhoneNumber.id),
    status: conversationStatus("status").notNull().default("open"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    assignedTo: uuid("assigned_to").references(() => staffUser.id),
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    lastInboundClass: msgClass("last_inbound_class"),
    unreadCount: integer("unread_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversation_last_message_idx").on(t.lastMessageAt)],
);

export const webhookEvent = pgTable("webhook_event", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  source: webhookSource("source").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  headers: jsonb("headers").notNull(),
  body: jsonb("body").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processError: text("process_error"),
});

export const mediaAsset = pgTable("media_asset", {
  id: uuid("id").primaryKey().defaultRandom(),
  waMediaId: text("wa_media_id"),
  mimeType: text("mime_type"),
  sha256Meta: text("sha256_meta"),
  fileSize: bigint("file_size", { mode: "number" }),
  storagePath: text("storage_path"),
  status: mediaStatus("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
  waIdExpiresAt: timestamp("wa_id_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageTemplate = pgTable("message_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  waTemplateId: text("wa_template_id").unique(),
  name: text("name").notNull(),
  language: text("language").notNull(),
  category: templateCategory("category").notNull(),
  status: templateStatus("status").notNull(),
  components: jsonb("components").notNull(),
  paramCount: integer("param_count").notNull().default(0),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationSetting = pgTable("automation_setting", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  allowedOrigin: outboundOrigin("allowed_origin").notNull(),
  config: jsonb("config").notNull().default({}),
  description: text("description").notNull(),
  updatedBy: uuid("updated_by").references(() => staffUser.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const featureFlag = pgTable("feature_flag", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull(),
  updatedBy: uuid("updated_by").references(() => staffUser.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outboundMessage = pgTable("outbound_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversation.id),
  kind: outboundKind("kind").notNull(),
  bodyText: text("body_text"),
  mediaAssetId: uuid("media_asset_id").references(() => mediaAsset.id),
  mediaCaption: text("media_caption"),
  templateId: uuid("template_id").references(() => messageTemplate.id),
  templateParams: jsonb("template_params"),
  origin: outboundOrigin("origin").notNull(),
  aiRunId: uuid("ai_run_id"),
  orderId: uuid("order_id"),
  status: outboundStatus("status").notNull().default("draft"),
  createdBy: uuid("created_by").references(() => staffUser.id),
  approvedBy: uuid("approved_by").references(() => staffUser.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedBy: uuid("rejected_by").references(() => staffUser.id),
  rejectedReason: text("rejected_reason"),
  autoSent: boolean("auto_sent").notNull().default(false),
  automationSettingKey: text("automation_setting_key").references(() => automationSetting.key),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  sendAttempts: integer("send_attempts").notNull().default(0),
  lastErrorCode: integer("last_error_code"),
  lastError: text("last_error"),
  needsManualCheck: boolean("needs_manual_check").notNull().default(false),
  wamid: text("wamid").unique(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const message = pgTable("message", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversation.id),
  wamid: text("wamid").unique(),
  direction: msgDirection("direction").notNull(),
  type: msgType("type").notNull(),
  textBody: text("text_body"),
  caption: text("caption"),
  mediaAssetId: uuid("media_asset_id").references(() => mediaAsset.id),
  contextWamid: text("context_wamid"),
  reactionEmoji: text("reaction_emoji"),
  location: jsonb("location"),
  waTimestamp: timestamp("wa_timestamp", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  status: msgStatus("status").notNull(),
  errorCode: integer("error_code"),
  errorTitle: text("error_title"),
  errorDetail: text("error_detail"),
  outboundMessageId: uuid("outbound_message_id").references(() => outboundMessage.id),
  sentBy: uuid("sent_by").references(() => staffUser.id),
  classification: msgClass("classification"),
  classificationConfidence: numeric("classification_confidence", { precision: 4, scale: 3 }),
  classificationModel: text("classification_model"),
  classificationPromptVersion: text("classification_prompt_version"),
  classificationAiRunId: uuid("classification_ai_run_id"),
  classifiedAt: timestamp("classified_at", { withTimezone: true }),
  classificationNeedsReview: boolean("classification_needs_review").notNull().default(false),
  classificationOverride: msgClass("classification_override"),
  classificationOverrideBy: uuid("classification_override_by").references(() => staffUser.id),
  classificationOverrideAt: timestamp("classification_override_at", { withTimezone: true }),
  urgency: text("urgency"),
  urgencyAiRunId: uuid("urgency_ai_run_id"),
  transcript: text("transcript"),
  transcriptAiRunId: uuid("transcript_ai_run_id"),
  mediaDescription: text("media_description"),
  mediaDescriptionAiRunId: uuid("media_description_ai_run_id"),
  raw: jsonb("raw").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageStatusEvent = pgTable("message_status_event", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  wamid: text("wamid").notNull(),
  status: text("status").notNull(),
  waTimestamp: timestamp("wa_timestamp", { withTimezone: true }).notNull(),
  recipientId: text("recipient_id"),
  errors: jsonb("errors"),
  pricing: jsonb("pricing"),
  conversation: jsonb("conversation"),
  raw: jsonb("raw").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiRun = pgTable("ai_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  stepKey: text("step_key").notNull(),
  stepVersion: text("step_version").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  inputHash: text("input_hash").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  valid: boolean("valid").notNull(),
  validationErrors: jsonb("validation_errors").notNull().default([]),
  latencyMs: integer("latency_ms"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costUsdMicros: bigint("cost_usd_micros", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorKind: actorKind("actor_kind").notNull(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

export const apiIdempotency = pgTable("api_idempotency", {
  key: text("key").primaryKey(),
  userId: uuid("user_id").notNull().references(() => staffUser.id),
  statusCode: integer("status_code").notNull(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ref: text("ref").notNull().unique(),
  contactId: uuid("contact_id").notNull().references(() => contact.id),
  conversationId: uuid("conversation_id").notNull().references(() => conversation.id),
  stage: orderStage("stage").notNull().default("new_enquiry"),
  waitingOn: waitingOn("waiting_on").notNull().default("none"),
  ownerId: uuid("owner_id").references(() => staffUser.id),
  eventDate: date("event_date"),
  needBy: date("need_by"),
  budgetKobo: bigint("budget_kobo", { mode: "number" }),
  riskLevel: riskLevel("risk_level").notNull().default("unknown"),
  riskReasons: jsonb("risk_reasons").notNull().default([]),
  lostReason: text("lost_reason"),
  lastCustomerContactAt: timestamp("last_customer_contact_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const defaultRule = pgTable("default_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  fieldKey: text("field_key").notNull(),
  value: jsonb("value").notNull(),
  appliesTo: jsonb("applies_to").notNull().default({}),
  enabled: boolean("enabled").notNull().default(false),
  createdBy: uuid("created_by").references(() => staffUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderField = pgTable("order_field", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: jsonb("value"),
  status: fieldStatus("status").notNull(),
  evidenceMessageIds: uuid("evidence_message_ids").array().notNull().default([]),
  defaultRuleId: uuid("default_rule_id").references(() => defaultRule.id),
  setBy: setBy("set_by").notNull(),
  aiRunId: uuid("ai_run_id").references(() => aiRun.id),
  confirmedBy: uuid("confirmed_by").references(() => staffUser.id),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLineItem = pgTable("order_line_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productCode: text("product_code"),
  productLabel: text("product_label").notNull(),
  attributes: jsonb("attributes").notNull().default({}),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quote = pgTable("quote", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  ref: text("ref").notNull(),
  version: integer("version").notNull(),
  status: quoteStatus("status").notNull().default("draft"),
  items: jsonb("items").notNull(),
  subtotalKobo: bigint("subtotal_kobo", { mode: "number" }).notNull(),
  deliveryKobo: bigint("delivery_kobo", { mode: "number" }).notNull().default(0),
  discountKobo: bigint("discount_kobo", { mode: "number" }).notNull().default(0),
  totalKobo: bigint("total_kobo", { mode: "number" }).notNull(),
  validUntil: date("valid_until"),
  sentOutboundId: uuid("sent_outbound_id").references(() => outboundMessage.id),
  createdBy: uuid("created_by").references(() => staffUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceRule = pgTable("price_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  productCode: text("product_code").notNull(),
  decoration: text("decoration"),
  minQty: integer("min_qty").notNull(),
  maxQty: integer("max_qty"),
  unitKobo: bigint("unit_kobo", { mode: "number" }).notNull(),
  addons: jsonb("addons").notNull().default({}),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadTimeRule = pgTable("lead_time_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  productCode: text("product_code").notNull(),
  process: text("process").notNull(),
  unitsPerDay: integer("units_per_day").notNull(),
  setupDays: numeric("setup_days", { precision: 4, scale: 1 }).notNull().default("0"),
  artworkDays: numeric("artwork_days", { precision: 4, scale: 1 }).notNull().default("0"),
  enabled: boolean("enabled").notNull().default(true),
});

export const capacityDay = pgTable(
  "capacity_day",
  {
    day: date("day").notNull(),
    process: text("process").notNull(),
    capacityUnits: integer("capacity_units").notNull(),
    bookedUnits: integer("booked_units").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.process] })],
);

export const paymentRequest = pgTable("payment_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  quoteId: uuid("quote_id").notNull().references(() => quote.id),
  kind: paymentKind("kind").notNull(),
  amountKobo: bigint("amount_kobo", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("NGN"),
  paystackReference: text("paystack_reference").notNull().unique(),
  paystackAccessCode: text("paystack_access_code"),
  authorizationUrl: text("authorization_url"),
  customerEmailUsed: text("customer_email_used").notNull(),
  status: paymentStatus("status").notNull().default("created"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  channel: text("channel"),
  feesKobo: bigint("fees_kobo", { mode: "number" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  rawVerify: jsonb("raw_verify"),
  linkOutboundId: uuid("link_outbound_id").references(() => outboundMessage.id),
  createdBy: uuid("created_by").references(() => staffUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const followup = pgTable("followup", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversation.id),
  reason: followupReason("reason").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  draftOutboundId: uuid("draft_outbound_id").references(() => outboundMessage.id),
  status: followupStatus("status").notNull().default("open"),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdByKind: actorKind("created_by_kind").notNull(),
  createdBy: uuid("created_by").references(() => staffUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const changeEvent = pgTable("change_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorKind: actorKind("actor_kind").notNull(),
  actorId: uuid("actor_id"),
  sourceMessageId: uuid("source_message_id").references(() => message.id),
  kind: changeKind("kind").notNull(),
  target: text("target"),
  before: jsonb("before"),
  after: jsonb("after"),
  reason: text("reason"),
  needsCustomerAck: boolean("needs_customer_ack").notNull().default(false),
  customerAckMessageId: uuid("customer_ack_message_id").references(() => message.id),
  notifyRoles: appRole("notify_roles").array().notNull().default([]),
  acknowledged: jsonb("acknowledged").notNull().default({}),
});

/** Staff knowledge bank — source files extracted to markdown for Merlin. */
export const knowledgeDoc = pgTable("knowledge_doc", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  sourceFilename: text("source_filename").notNull(),
  sourceMime: text("source_mime").notNull(),
  markdown: text("markdown").notNull(),
  charCount: integer("char_count").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").references(() => staffUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
