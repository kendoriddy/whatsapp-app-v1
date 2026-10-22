import { eq, and, sql } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import {
  webhookEvent,
  contact,
  conversation,
  waPhoneNumber,
  message,
  mediaAsset,
  messageStatusEvent,
  outboundMessage,
} from "@mmabon/db";
import { parseMetaWebhook, mapInboundType, extractTextBody, extractCaption } from "@mmabon/whatsapp";
import { Jobs, type Queue } from "@mmabon/queue";

const STATUS_RANK: Record<string, number> = {
  accepted: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export async function processWaEvent(db: Db, queue: Queue, webhookEventId: number): Promise<void> {
  const [evt] = await db.select().from(webhookEvent).where(eq(webhookEvent.id, webhookEventId)).limit(1);
  if (!evt) return;
  if (evt.processedAt) return;

  try {
    const payload = parseMetaWebhook(evt.body);
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === "messages") {
          await handleMessagesChange(db, queue, entry.id, change.value as Record<string, unknown>);
        } else if (
          [
            "phone_number_quality_update",
            "phone_number_name_update",
            "account_update",
            "account_review_update",
            "business_capability_update",
            "message_template_status_update",
          ].includes(change.field)
        ) {
          // best-effort phone metadata updates
          const meta = change.value as { display_phone_number?: string; phone_number_id?: string; event?: string };
          if (meta.phone_number_id) {
            await db
              .insert(waPhoneNumber)
              .values({
                phoneNumberId: meta.phone_number_id,
                displayPhoneNumber: meta.display_phone_number
                  ? `+${meta.display_phone_number.replace(/\D/g, "")}`
                  : meta.phone_number_id,
                wabaId: entry.id,
                label: meta.display_phone_number ?? meta.phone_number_id,
                lifecycle: "connected",
                isActive: false,
              })
              .onConflictDoNothing();
          }
        }
      }
    }
    await db
      .update(webhookEvent)
      .set({ processedAt: new Date(), processError: null })
      .where(eq(webhookEvent.id, webhookEventId));
  } catch (e) {
    await db
      .update(webhookEvent)
      .set({ processError: String(e) })
      .where(eq(webhookEvent.id, webhookEventId));
    throw e;
  }
}

async function handleMessagesChange(
  db: Db,
  queue: Queue,
  wabaId: string,
  value: Record<string, unknown>,
): Promise<void> {
  const metadata = value.metadata as { display_phone_number?: string; phone_number_id?: string } | undefined;
  const phoneNumberId = metadata?.phone_number_id;
  if (!phoneNumberId) return;

  let [phone] = await db
    .select()
    .from(waPhoneNumber)
    .where(eq(waPhoneNumber.phoneNumberId, phoneNumberId))
    .limit(1);
  if (!phone) {
    const display = metadata?.display_phone_number
      ? `+${String(metadata.display_phone_number).replace(/\D/g, "")}`
      : `+${phoneNumberId}`;
    const inserted = await db
      .insert(waPhoneNumber)
      .values({
        phoneNumberId,
        displayPhoneNumber: display,
        wabaId,
        label: display,
        lifecycle: "connected",
        isActive: false,
      })
      .returning();
    phone = inserted[0]!;
  }

  const contactsArr = (value.contacts as Array<{ wa_id: string; profile?: { name?: string } }> | undefined) ?? [];
  const messages = (value.messages as Array<Record<string, unknown>> | undefined) ?? [];
  const statuses = (value.statuses as Array<Record<string, unknown>> | undefined) ?? [];

  for (const msg of messages) {
    const waId = String(msg.from);
    const profile = contactsArr.find((c) => c.wa_id === waId)?.profile?.name;
    const [c] = await db
      .insert(contact)
      .values({ waId, e164: `+${waId}`, profileName: profile })
      .onConflictDoUpdate({
        target: contact.waId,
        set: { profileName: profile ?? sql`${contact.profileName}` },
      })
      .returning();

    let [conv] = await db
      .select()
      .from(conversation)
      .where(and(eq(conversation.contactId, c!.id), eq(conversation.waPhoneNumberId, phone.id)))
      .limit(1);
    if (!conv) {
      const created = await db
        .insert(conversation)
        .values({ contactId: c!.id, waPhoneNumberId: phone.id, status: "open" })
        .returning();
      conv = created[0]!;
    } else if (conv.status === "closed") {
      await db.update(conversation).set({ status: "open" }).where(eq(conversation.id, conv.id));
    }

    const type = mapInboundType(String(msg.type));
    let mediaId: string | undefined;
    const mediaObj = msg[type] as { id?: string; mime_type?: string; sha256?: string } | undefined;
    if (mediaObj?.id && ["image", "audio", "video", "document", "sticker"].includes(type)) {
      const [m] = await db
        .insert(mediaAsset)
        .values({
          waMediaId: mediaObj.id,
          mimeType: mediaObj.mime_type,
          sha256Meta: mediaObj.sha256,
          status: "pending",
          waIdExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();
      mediaId = m!.id;
      await queue.send(Jobs.WA_DOWNLOAD_MEDIA, { mediaAssetId: mediaId }, { singletonKey: `media-${mediaId}` });
    }

    const waTs = new Date(Number(msg.timestamp) * 1000);
    const textBody = extractTextBody(msg);
    const caption = extractCaption(msg);
    const preview = (textBody ?? caption ?? `[${type}]`).slice(0, 140);

    const inserted = await db
      .insert(message)
      .values({
        conversationId: conv.id,
        wamid: String(msg.id),
        direction: "inbound",
        type: type as never,
        textBody,
        caption,
        mediaAssetId: mediaId,
        contextWamid: (msg.context as { id?: string } | undefined)?.id,
        reactionEmoji: type === "reaction" ? (msg.reaction as { emoji?: string })?.emoji : null,
        location: type === "location" ? msg.location : null,
        waTimestamp: waTs,
        status: "received",
        raw: msg,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted[0]) {
      await db
        .update(conversation)
        .set({
          lastInboundAt: waTs,
          lastMessageAt: waTs,
          lastMessagePreview: preview,
          unreadCount: sql`${conversation.unreadCount} + 1`,
        })
        .where(eq(conversation.id, conv.id));

      if (!["reaction", "unsupported"].includes(type)) {
        await queue.send(Jobs.AI_CLASSIFY_MESSAGE, { messageId: inserted[0].id }, {
          singletonKey: `classify-${inserted[0].id}`,
        });
      }
    }
  }

  for (const st of statuses) {
    const wamid = String(st.id);
    const status = String(st.status);
    const waTs = new Date(Number(st.timestamp) * 1000);
    await db
      .insert(messageStatusEvent)
      .values({
        wamid,
        status,
        waTimestamp: waTs,
        recipientId: st.recipient_id ? String(st.recipient_id) : null,
        errors: st.errors ?? null,
        pricing: st.pricing ?? null,
        conversation: st.conversation ?? null,
        raw: st,
      })
      .onConflictDoNothing();

    const [msg] = await db.select().from(message).where(eq(message.wamid, wamid)).limit(1);
    if (!msg) continue;

    if (status === "failed") {
      if (msg.status !== "delivered" && msg.status !== "read") {
        const err0 = (st.errors as Array<{ code?: number; title?: string; message?: string }> | undefined)?.[0];
        await db
          .update(message)
          .set({
            status: "failed",
            errorCode: err0?.code ?? null,
            errorTitle: err0?.title ?? null,
            errorDetail: err0?.message ?? null,
          })
          .where(eq(message.id, msg.id));
        if (msg.outboundMessageId) {
          await db
            .update(outboundMessage)
            .set({ status: "failed", lastErrorCode: err0?.code ?? null, lastError: err0?.message ?? null })
            .where(eq(outboundMessage.id, msg.outboundMessageId));
        }
      }
      continue;
    }

    const newRank = STATUS_RANK[status];
    const curRank = STATUS_RANK[msg.status] ?? -1;
    if (newRank !== undefined && newRank > curRank && msg.status !== "failed") {
      await db.update(message).set({ status: status as never }).where(eq(message.id, msg.id));
      if (msg.outboundMessageId && status === "sent") {
        await db.update(outboundMessage).set({ status: "sent" }).where(eq(outboundMessage.id, msg.outboundMessageId));
      }
    }
  }
}
