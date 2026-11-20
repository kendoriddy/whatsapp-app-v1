import { asc, eq } from "drizzle-orm";
import { mediaAsset, message, outboundMessage } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, jsonError } from "@/lib/auth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req);
    const { id } = await ctx.params;
    const db = getDb();
    const rows = await db
      .select({
        id: message.id,
        direction: message.direction,
        textBody: message.textBody,
        caption: message.caption,
        type: message.type,
        status: message.status,
        classification: message.classification,
        waTimestamp: message.waTimestamp,
        outboundMessageId: message.outboundMessageId,
        outboundOrigin: outboundMessage.origin,
        automationSettingKey: outboundMessage.automationSettingKey,
        autoSent: outboundMessage.autoSent,
        mediaId: mediaAsset.id,
        mediaStatus: mediaAsset.status,
        mediaMimeType: mediaAsset.mimeType,
        mediaFilename: mediaAsset.originalFilename,
      })
      .from(message)
      .leftJoin(
        outboundMessage,
        eq(message.outboundMessageId, outboundMessage.id),
      )
      .leftJoin(mediaAsset, eq(message.mediaAssetId, mediaAsset.id))
      .where(eq(message.conversationId, id))
      .orderBy(asc(message.waTimestamp))
      .limit(200);

    const items = rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      textBody: r.textBody,
      caption: r.caption,
      type: r.type,
      status: r.status,
      classification: r.classification,
      waTimestamp: r.waTimestamp,
      senderLabel:
        r.direction === "outbound" &&
        r.outboundOrigin === "ai_suggestion" &&
        r.automationSettingKey === "auto_send.merlin_replies"
          ? "Merlin"
          : r.direction === "inbound"
            ? "Customer"
            : "Staff",
      autoSent: r.autoSent ?? false,
      media: r.mediaId
        ? {
            id: r.mediaId,
            status: r.mediaStatus,
            mimeType: r.mediaMimeType,
            filename: r.mediaFilename,
            url: r.mediaStatus === "stored" ? `/api/media/${r.mediaId}` : null,
          }
        : null,
    }));

    return Response.json({ items, nextCursor: null });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
