import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type PgClientOpts = {
  max?: number;
  /** Seconds to wait while establishing a connection (default 10). */
  connectTimeoutSeconds?: number;
  /** Seconds before an idle connection is closed (default 20). */
  idleTimeoutSeconds?: number;
  /** Per-query statement timeout in ms (default 15_000). */
  statementTimeoutMs?: number;
};

function postgresOpts(opts: PgClientOpts) {
  return {
    max: opts.max ?? 3,
    prepare: false as const,
    connect_timeout: opts.connectTimeoutSeconds ?? 10,
    idle_timeout: opts.idleTimeoutSeconds ?? 20,
    connection: {
      // Postgres GUC is milliseconds; aborts stuck queries so max:1 pools recover.
      statement_timeout: opts.statementTimeoutMs ?? 15_000,
    },
  };
}

export function createDb(connectionString: string, opts: PgClientOpts = {}) {
  const sql = postgres(connectionString, postgresOpts(opts));
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

export function createSql(connectionString: string, opts: PgClientOpts = {}) {
  return postgres(connectionString, postgresOpts(opts));
}

export type Sql = ReturnType<typeof createSql>;
