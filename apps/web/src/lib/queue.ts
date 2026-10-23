import { createPgBossQueue, type Queue } from "@mmabon/queue";
import { getEnv } from "./env";

let queue: (Queue & { boss: unknown }) | null = null;
let started: Promise<Queue> | null = null;

/** One shared enqueue client per serverless isolate (avoids EMAXCONNSESSION). */
export async function getQueue(): Promise<Queue> {
  if (queue) return queue;
  if (!started) {
    started = (async () => {
      const q = createPgBossQueue(getEnv().DATABASE_URL_DIRECT, {
        max: 1,
        applicationName: "mmabon-web-enqueue",
      });
      await q.start();
      queue = q;
      return q;
    })();
  }
  return started;
}
