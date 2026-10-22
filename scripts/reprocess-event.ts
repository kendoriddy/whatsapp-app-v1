#!/usr/bin/env tsx
import "dotenv/config";
import { loadEnv } from "../packages/shared/src/env.ts";
import { createDb } from "../packages/db/src/client.ts";
import { createPgBossQueue, Jobs } from "../packages/queue/src/index.ts";
import { eq } from "drizzle-orm";
import { webhookEvent } from "../packages/db/src/schema.ts";

const id = Number(process.argv.find((a) => a.startsWith("--id="))?.slice(5) ?? process.argv[process.argv.indexOf("--id") + 1]);
if (!id) throw new Error("--id required");
const env = loadEnv();
const db = createDb(env.DATABASE_URL_DIRECT);
await db.update(webhookEvent).set({ processedAt: null, processError: null }).where(eq(webhookEvent.id, id));
const queue = createPgBossQueue(env.DATABASE_URL_DIRECT);
await queue.start();
await queue.send(Jobs.WA_PROCESS_EVENT, { webhookEventId: id });
console.log("requeued", id);
process.exit(0);
