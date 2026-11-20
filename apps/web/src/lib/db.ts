import { createDb, createSql } from "@mmabon/db";
import { getEnv } from "./env";

let db: ReturnType<typeof createDb> | null = null;
let sql: ReturnType<typeof createSql> | null = null;

const webPool = {
  // Serverless: one connection per isolate; transaction pooler tolerates this.
  max: 1,
  connectTimeoutSeconds: 10,
  idleTimeoutSeconds: 20,
  statementTimeoutMs: 15_000,
} as const;

export function getDb() {
  if (!db) db = createDb(getEnv().DATABASE_URL, webPool);
  return db;
}

export function getSql() {
  if (!sql) sql = createSql(getEnv().DATABASE_URL, webPool);
  return sql;
}
