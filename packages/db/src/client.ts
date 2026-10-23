import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type PgClientOpts = { max?: number };

export function createDb(connectionString: string, opts: PgClientOpts = {}) {
  const sql = postgres(connectionString, {
    max: opts.max ?? 3,
    prepare: false,
  });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

export function createSql(connectionString: string, opts: PgClientOpts = {}) {
  return postgres(connectionString, {
    max: opts.max ?? 3,
    prepare: false,
  });
}

export type Sql = ReturnType<typeof createSql>;
