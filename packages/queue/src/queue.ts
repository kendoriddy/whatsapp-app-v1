import { PgBoss } from "pg-boss";
import { Jobs, type JobName } from "./jobs.js";

export type SendOpts = {
  singletonKey?: string;
  retryLimit?: number;
  retryBackoff?: boolean;
  retryDelay?: number;
  startAfter?: number | string | Date;
  expireInSeconds?: number;
};

export interface Queue {
  send(name: JobName, data: object, opts?: SendOpts): Promise<string | null>;
  work<T extends object>(
    name: JobName,
    handler: (job: { id: string; data: T }) => Promise<void>,
  ): Promise<string>;
  schedule(name: JobName, cron: string, data?: object): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

const ALL_JOB_NAMES = Object.values(Jobs);

export type PgBossQueueOpts = {
  /** pg pool size (Supabase session pooler ~15 total — keep this tiny). */
  max?: number;
  applicationName?: string;
};

export function createPgBossQueue(
  connectionString: string,
  opts: PgBossQueueOpts = {},
): Queue & { boss: PgBoss } {
  const boss = new PgBoss({
    connectionString,
    schema: "pgboss",
    application_name: opts.applicationName ?? "mmabon-desk",
    max: opts.max ?? 2,
  });

  // pg-boss v10+ requires createQueue before send/work; swallow so callers don't crash the process
  boss.on("error", (err) => {
    console.error("[pg-boss]", err);
  });

  const ensured = new Set<string>();
  async function ensureQueue(name: string) {
    if (ensured.has(name)) return;
    await boss.createQueue(name);
    ensured.add(name);
  }

  return {
    boss,
    async start() {
      await boss.start();
      for (const name of ALL_JOB_NAMES) {
        await ensureQueue(name);
      }
    },
    async stop() {
      await boss.stop();
    },
    async send(name, data, opts = {}) {
      await ensureQueue(name);
      const sendOpts: Record<string, unknown> = {
        retryLimit: opts.retryLimit ?? 10,
        retryBackoff: opts.retryBackoff ?? true,
        retryDelay: opts.retryDelay ?? 2,
      };
      if (opts.singletonKey !== undefined)
        sendOpts.singletonKey = opts.singletonKey;
      if (opts.startAfter !== undefined) sendOpts.startAfter = opts.startAfter;
      if (opts.expireInSeconds !== undefined)
        sendOpts.expireInSeconds = opts.expireInSeconds;
      return boss.send(name, data, sendOpts);
    },
    async work(name, handler) {
      await ensureQueue(name);
      return boss.work(name, async (jobs) => {
        for (const job of jobs) {
          await handler({ id: job.id, data: job.data as never });
        }
      });
    },
    async schedule(name, cron, data = {}) {
      await ensureQueue(name);
      await boss.schedule(name, cron, data);
    },
  };
}

/** In-memory queue for unit tests */
export function createMemoryQueue(): Queue & {
  jobs: Array<{ name: string; data: object }>;
} {
  const jobs: Array<{ name: string; data: object }> = [];
  const handlers = new Map<
    string,
    (job: { id: string; data: object }) => Promise<void>
  >();
  return {
    jobs,
    async start() {},
    async stop() {},
    async send(name, data) {
      const id = crypto.randomUUID();
      jobs.push({ name, data });
      const h = handlers.get(name);
      if (h) await h({ id, data });
      return id;
    },
    async work(name, handler) {
      handlers.set(name, handler as never);
      return name;
    },
    async schedule() {},
  };
}
