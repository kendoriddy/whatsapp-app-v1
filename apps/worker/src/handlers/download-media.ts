import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull, or, gt, isNull } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import {
  mediaAsset,
  message,
  conversation,
  waPhoneNumber,
} from "@mmabon/db";
import { createGraphClient, type GraphMediaClient } from "@mmabon/whatsapp";
import { loadEnv } from "@mmabon/shared";
import { Jobs, type Queue } from "@mmabon/queue";
import {
  buildMediaStoragePath,
  MAX_MEDIA_BYTES,
} from "../lib/media-path.js";
import { uploadMediaFile } from "../lib/media-storage.js";

export type DownloadMediaDeps = {
  graph?: Pick<GraphMediaClient, "getMedia" | "downloadUrl">;
  upload?: (args: {
    storagePath: string;
    mime: string;
    bytes: Buffer;
  }) => Promise<void>;
  now?: () => Date;
};

function defaultGraph(): Pick<GraphMediaClient, "getMedia" | "downloadUrl"> {
  const env = loadEnv();
  return createGraphClient({
    baseUrl: env.META_GRAPH_API_BASE_URL,
    version: env.META_GRAPH_API_VERSION,
    token: env.META_SYSTEM_USER_TOKEN,
  });
}

export async function fetchMediaBytes(args: {
  waMediaId: string;
  phoneNumberId: string;
  graph: Pick<GraphMediaClient, "getMedia" | "downloadUrl">;
}): Promise<{ bytes: Buffer; mimeType: string; sha256: string; fileSize: number }> {
  const meta = (await args.graph.getMedia(
    args.waMediaId,
    args.phoneNumberId,
  )) as {
    url?: string;
    mime_type?: string;
    sha256?: string;
    file_size?: number;
    error?: { message?: string; code?: number };
  };
  if (meta?.error) {
    throw new Error(
      `Graph media error: ${meta.error.message ?? meta.error.code ?? "unknown"}`,
    );
  }
  if (!meta?.url) throw new Error("Media metadata missing url");

  let bytes: Buffer;
  try {
    bytes = await args.graph.downloadUrl(meta.url);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) {
      const fresh = await args.graph.getMedia(args.waMediaId, args.phoneNumberId);
      if (!fresh?.url) throw e;
      bytes = await args.graph.downloadUrl(fresh.url);
    } else {
      throw e;
    }
  }

  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new Error(`Media exceeds ${MAX_MEDIA_BYTES} byte limit`);
  }

  return {
    bytes,
    mimeType: meta.mime_type ?? "application/octet-stream",
    sha256: meta.sha256 ?? "",
    fileSize: meta.file_size ?? bytes.byteLength,
  };
}

export function verifyMediaSha256(
  bytes: Buffer,
  sha256Meta: string | null | undefined,
): void {
  if (!sha256Meta) return;
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256Meta.toLowerCase()) {
    throw new Error("SHA_MISMATCH");
  }
}

export async function handleDownloadMedia(
  db: Db,
  mediaAssetId: string,
  deps: DownloadMediaDeps = {},
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const graph = deps.graph ?? defaultGraph();
  const upload = deps.upload ?? uploadMediaFile;

  const [asset] = await db
    .select()
    .from(mediaAsset)
    .where(eq(mediaAsset.id, mediaAssetId))
    .limit(1);
  if (!asset) return;
  if (asset.status === "stored") return;
  if (asset.status === "expired") return;

  if (asset.waIdExpiresAt && asset.waIdExpiresAt.getTime() <= now.getTime()) {
    await db
      .update(mediaAsset)
      .set({ status: "expired", updatedAt: now, lastError: "wa_media_id expired" })
      .where(eq(mediaAsset.id, mediaAssetId));
    return;
  }

  if (!asset.waMediaId) {
    await db
      .update(mediaAsset)
      .set({
        status: "failed",
        lastError: "missing wa_media_id",
        updatedAt: now,
        attempts: asset.attempts + 1,
      })
      .where(eq(mediaAsset.id, mediaAssetId));
    return;
  }

  const [msg] = await db
    .select({
      conversationId: message.conversationId,
      phoneNumberId: waPhoneNumber.phoneNumberId,
    })
    .from(message)
    .innerJoin(conversation, eq(message.conversationId, conversation.id))
    .innerJoin(waPhoneNumber, eq(conversation.waPhoneNumberId, waPhoneNumber.id))
    .where(eq(message.mediaAssetId, mediaAssetId))
    .limit(1);

  const env = loadEnv();
  const phoneNumberId = msg?.phoneNumberId ?? env.META_PHONE_NUMBER_ID;
  const conversationId = msg?.conversationId ?? "unknown";

  await db
    .update(mediaAsset)
    .set({ status: "downloading", updatedAt: now })
    .where(eq(mediaAsset.id, mediaAssetId));

  try {
    const fetched = await fetchMediaBytes({
      waMediaId: asset.waMediaId,
      phoneNumberId,
      graph,
    });
    verifyMediaSha256(fetched.bytes, asset.sha256Meta);

    const mimeType = asset.mimeType || fetched.mimeType || "application/octet-stream";
    const storagePath = buildMediaStoragePath({
      conversationId,
      mediaAssetId,
      mimeType,
      now,
    });

    await upload({
      storagePath,
      mime: mimeType,
      bytes: fetched.bytes,
    });

    await db
      .update(mediaAsset)
      .set({
        status: "stored",
        storagePath,
        mimeType,
        fileSize: fetched.bytes.byteLength,
        downloadedAt: now,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(mediaAsset.id, mediaAssetId));
  } catch (e) {
    const attempts = asset.attempts + 1;
    const failed = attempts >= 8;
    await db
      .update(mediaAsset)
      .set({
        status: failed ? "failed" : "pending",
        attempts,
        lastError: String((e as Error).message ?? e).slice(0, 2000),
        updatedAt: now,
      })
      .where(eq(mediaAsset.id, mediaAssetId));
    throw e;
  }
}

/** Re-enqueue inbound media that never finished downloading. */
export async function requeueStuckMedia(db: Db, queue: Queue): Promise<number> {
  const now = new Date();
  const rows = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(
      and(
        inArray(mediaAsset.status, ["pending", "failed"]),
        isNotNull(mediaAsset.waMediaId),
        or(isNull(mediaAsset.waIdExpiresAt), gt(mediaAsset.waIdExpiresAt, now)),
      ),
    )
    .limit(200);

  for (const row of rows) {
    await queue.send(
      Jobs.WA_DOWNLOAD_MEDIA,
      { mediaAssetId: row.id },
      {
        singletonKey: `media-${row.id}`,
        retryLimit: 8,
        retryDelay: 30,
        retryBackoff: true,
        expireInSeconds: 600,
      },
    );
  }
  return rows.length;
}
