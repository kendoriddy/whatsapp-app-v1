import { createDb, createSql } from "@mmabon/db";
import { getEnv } from "./env";

let db: ReturnType<typeof createDb> | null = null;
let sql: ReturnType<typeof createSql> | null = null;

export function getDb() {
  if (!db) db = createDb(getEnv().DATABASE_URL);
  return db;
}

export function getSql() {
  if (!sql) sql = createSql(getEnv().DATABASE_URL);
  return sql;
}
