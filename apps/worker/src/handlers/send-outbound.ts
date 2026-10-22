import { eq } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import {
  outboundMessage,
  staffUser,
  automationSetting,
  featureFlag,
  conversation,
  contact,
  waPhoneNumber,
  messageTemplate,
  message,
} from "@mmabon/db";
import { sendOutbound, isWindowOpen } from "@mmabon/whatsapp";
import { loadEnv } from "@mmabon/shared";

export async function handleSendOutbound(db: Db, outboundId: string): Promise<void> {
  const env = loadEnv();

  await sendOutbound(outboundId, {
    graphBaseUrl: env.META_GRAPH_API_BASE_URL,
    graphVersion: env.META_GRAPH_API_VERSION,
    token: env.META_SYSTEM_USER_TOKEN,
    async getOutbound(id) {
      const [row] = await db.select().from(outboundMessage).where(eq(outboundMessage.id, id)).limit(1);
      if (!row) return null;
      return {
        id: row.id,
        status: row.status,
        approvedBy: row.approvedBy,
        autoSent: row.autoSent,
        automationSettingKey: row.automationSettingKey,
        kind: row.kind,
        bodyText: row.bodyText,
        templateParams: row.templateParams,
        wamid: row.wamid,
        origin: row.origin,
      };
    },
    async getApproverRole(userId) {
      const [u] = await db.select().from(staffUser).where(eq(staffUser.id, userId)).limit(1);
      return u?.role ?? null;
    },
    async getAutomationEnabled(key, origin) {
      const [s] = await db.select().from(automationSetting).where(eq(automationSetting.key, key)).limit(1);
      return Boolean(s?.enabled && s.allowedOrigin === origin);
    },
    async isSendsPaused() {
      const [f] = await db.select().from(featureFlag).where(eq(featureFlag.key, "sends.paused")).limit(1);
      return Boolean(f?.enabled);
    },
    async getPhoneNumberId(id) {
      const [row] = await db.select().from(outboundMessage).where(eq(outboundMessage.id, id)).limit(1);
      const [conv] = await db.select().from(conversation).where(eq(conversation.id, row!.conversationId)).limit(1);
      const [phone] = await db.select().from(waPhoneNumber).where(eq(waPhoneNumber.id, conv!.waPhoneNumberId)).limit(1);
      return phone?.phoneNumberId ?? env.META_PHONE_NUMBER_ID;
    },
    async getRecipientWaId(id) {
      const [row] = await db.select().from(outboundMessage).where(eq(outboundMessage.id, id)).limit(1);
      const [conv] = await db.select().from(conversation).where(eq(conversation.id, row!.conversationId)).limit(1);
      const [c] = await db.select().from(contact).where(eq(contact.id, conv!.contactId)).limit(1);
      return c!.waId;
    },
    async getTemplateName(id) {
      const [row] = await db.select().from(outboundMessage).where(eq(outboundMessage.id, id)).limit(1);
      if (!row?.templateId) return null;
      const [t] = await db.select().from(messageTemplate).where(eq(messageTemplate.id, row.templateId)).limit(1);
      return t ? { name: t.name, language: t.language } : null;
    },
    async markSending(id) {
      const [row] = await db.select().from(outboundMessage).where(eq(outboundMessage.id, id)).limit(1);
      if (row && row.kind !== "template") {
        const [conv] = await db.select().from(conversation).where(eq(conversation.id, row.conversationId)).limit(1);
        if (!isWindowOpen(conv?.lastInboundAt ?? null, new Date(), env.WINDOW_SAFETY_MARGIN_SECONDS)) {
          await db
            .update(outboundMessage)
            .set({ status: "failed", lastError: "WINDOW_CLOSED" })
            .where(eq(outboundMessage.id, id));
          throw new Error("WINDOW_CLOSED");
        }
      }
      await db
        .update(outboundMessage)
        .set({ status: "sending", sendAttempts: (row?.sendAttempts ?? 0) + 1 })
        .where(eq(outboundMessage.id, id));
    },
    async markSent(id, wamid) {
      const [row] = await db.select().from(outboundMessage).where(eq(outboundMessage.id, id)).limit(1);
      await db
        .update(outboundMessage)
        .set({ status: "sent", wamid, sentAt: new Date() })
        .where(eq(outboundMessage.id, id));
      if (row) {
        const [msg] = await db
          .insert(message)
          .values({
            conversationId: row.conversationId,
            wamid,
            direction: "outbound",
            type: row.kind === "template" ? "template" : row.kind === "media" ? "image" : "text",
            textBody: row.bodyText,
            caption: row.mediaCaption,
            mediaAssetId: row.mediaAssetId,
            waTimestamp: new Date(),
            status: "accepted",
            outboundMessageId: row.id,
            sentBy: row.approvedBy ?? row.createdBy,
            raw: { wamid },
          })
          .returning();
        await db
          .update(conversation)
          .set({
            lastOutboundAt: new Date(),
            lastMessageAt: new Date(),
            lastMessagePreview: (row.bodyText ?? "[outbound]").slice(0, 140),
          })
          .where(eq(conversation.id, row.conversationId));
        void msg;
      }
    },
    async markFailed(id, code, error, needsManualCheck = false) {
      await db
        .update(outboundMessage)
        .set({
          status: "failed",
          lastErrorCode: code,
          lastError: error,
          needsManualCheck,
        })
        .where(eq(outboundMessage.id, id));
    },
  });
}
