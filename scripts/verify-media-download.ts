#!/usr/bin/env tsx
/**
 * End-to-end check against mock Graph + Supabase storage (local).
 * Usage: pnpm tsx scripts/verify-media-download.ts
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
for (const name of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), name);
  if (existsSync(p)) config({ path: p });
}

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { createDb, mediaAsset, message, conversation } from "@mmabon/db";
import { createGraphClient } from "@mmabon/whatsapp";
import { loadEnv } from "@mmabon/shared";
import { handleDownloadMedia } from "../apps/worker/src/handlers/download-media.ts";

const JPEG = readFileSync("fixtures/media/pixel.jpg");
const JPEG_SHA = createHash("sha256").update(JPEG).digest("hex");

async function main() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL_DIRECT);
  const mockBase = "http://127.0.0.1:4010";

  const [conv] = await db.select().from(conversation).limit(1);
  if (!conv)
    throw new Error("No conversation in DB — open inbox / ingest first");

  const [asset] = await db
    .insert(mediaAsset)
    .values({
      waMediaId: "verify-media-1",
      mimeType: "image/jpeg",
      sha256Meta: JPEG_SHA,
      originalFilename: "verify.jpg",
      status: "pending",
      waIdExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();

  await db.insert(message).values({
    conversationId: conv.id,
    wamid: `wamid.VERIFY.media.${Date.now()}`,
    direction: "inbound",
    type: "image",
    caption: "verify download",
    mediaAssetId: asset!.id,
    waTimestamp: new Date(),
    status: "received",
    raw: { type: "image", image: { id: "verify-media-1" } },
  });

  const graph = createGraphClient({
    baseUrl: mockBase,
    version: "v25.0",
    token: env.META_SYSTEM_USER_TOKEN,
  });

  await handleDownloadMedia(db, asset!.id, { graph });

  const [stored] = await db
    .select()
    .from(mediaAsset)
    .where(eq(mediaAsset.id, asset!.id))
    .limit(1);

  console.log({
    id: stored?.id,
    status: stored?.status,
    storagePath: stored?.storagePath,
    fileSize: stored?.fileSize,
    conversationId: conv.id,
    mediaUrl: `/api/media/${stored?.id}`,
  });

  if (stored?.status !== "stored") {
    throw new Error(
      `Expected stored, got ${stored?.status}: ${stored?.lastError}`,
    );
  }

  // 404-once then success
  await fetch(`${mockBase}/_test/fail-once/verify-media-2`, { method: "POST" });
  const [asset2] = await db
    .insert(mediaAsset)
    .values({
      waMediaId: "verify-media-2",
      mimeType: "image/jpeg",
      sha256Meta: JPEG_SHA,
      originalFilename: "verify2.jpg",
      status: "pending",
      waIdExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();
  await db.insert(message).values({
    conversationId: conv.id,
    wamid: `wamid.VERIFY.media2.${Date.now()}`,
    direction: "inbound",
    type: "image",
    caption: "verify 404 retry",
    mediaAssetId: asset2!.id,
    waTimestamp: new Date(),
    status: "received",
    raw: {},
  });
  await handleDownloadMedia(db, asset2!.id, { graph });
  const [stored2] = await db
    .select()
    .from(mediaAsset)
    .where(eq(mediaAsset.id, asset2!.id))
    .limit(1);
  console.log({ retryStatus: stored2?.status, path: stored2?.storagePath });
  if (stored2?.status !== "stored") {
    throw new Error(`404-retry expected stored, got ${stored2?.status}`);
  }

  // Hash mismatch must not store
  const [asset3] = await db
    .insert(mediaAsset)
    .values({
      waMediaId: "verify-media-3",
      mimeType: "image/jpeg",
      sha256Meta: "0".repeat(64),
      status: "pending",
      waIdExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();
  await db.insert(message).values({
    conversationId: conv.id,
    wamid: `wamid.VERIFY.media3.${Date.now()}`,
    direction: "inbound",
    type: "image",
    mediaAssetId: asset3!.id,
    waTimestamp: new Date(),
    status: "received",
    raw: {},
  });
  await expectReject(() => handleDownloadMedia(db, asset3!.id, { graph }));
  const [bad] = await db
    .select()
    .from(mediaAsset)
    .where(eq(mediaAsset.id, asset3!.id))
    .limit(1);
  console.log({ mismatchStatus: bad?.status, lastError: bad?.lastError });
  if (bad?.status === "stored") throw new Error("mismatch should not store");

  console.log("OK", { conversationId: conv.id, mediaId: stored!.id });
  process.exit(0);
}

async function expectReject(fn: () => Promise<void>) {
  try {
    await fn();
    throw new Error("expected throw");
  } catch (e) {
    if (String(e).includes("expected throw")) throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
