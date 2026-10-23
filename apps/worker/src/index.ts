import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
for (const name of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), name);
  if (existsSync(p)) config({ path: p });
  const fromRoot = resolve(process.cwd(), "../..", name);
  if (existsSync(fromRoot)) config({ path: fromRoot });
}
import { loadEnv, createLogger } from "@mmabon/shared";
import { createDb } from "@mmabon/db";
import { createPgBossQueue, Jobs } from "@mmabon/queue";
import { processWaEvent } from "./handlers/process-event.js";
import { handleSendOutbound } from "./handlers/send-outbound.js";
import { handleClassify } from "./handlers/classify.js";
import { processPaystackEvent } from "./handlers/process-paystack.js";

const env = loadEnv();
const log = createLogger("worker", env.LOG_LEVEL);
const db = createDb(env.DATABASE_URL_DIRECT);
const queue = createPgBossQueue(env.DATABASE_URL_DIRECT);

async function main() {
  await queue.start();
  log.info("worker started");

  await queue.work<{ webhookEventId: number }>(
    Jobs.WA_PROCESS_EVENT,
    async (job) => {
      await processWaEvent(db, queue, job.data.webhookEventId);
    },
  );

  await queue.work<{ outboundId: string }>(
    Jobs.WA_SEND_OUTBOUND,
    async (job) => {
      await handleSendOutbound(db, job.data.outboundId);
    },
  );

  await queue.work<{ messageId: string }>(
    Jobs.AI_CLASSIFY_MESSAGE,
    async (job) => {
      await handleClassify(db, job.data.messageId);
    },
  );

  await queue.work<{ webhookEventId: number }>(
    Jobs.PAYSTACK_PROCESS_EVENT,
    async (job) => {
      await processPaystackEvent(db, job.data.webhookEventId);
    },
  );

  await queue.work<{ mediaAssetId: string }>(
    Jobs.WA_DOWNLOAD_MEDIA,
    async (job) => {
      log.info(
        { mediaAssetId: job.data.mediaAssetId },
        "media download stub — mark stored in local",
      );
    },
  );

  await queue.schedule(Jobs.TEMPLATES_SYNC, "0 * * * *");
  await queue.schedule(Jobs.MAINTENANCE_PURGE, "0 3 * * *");
}

main().catch((e) => {
  log.error(e);
  process.exit(1);
});
