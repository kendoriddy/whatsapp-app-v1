import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export function createDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 10, prepare: false });
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

export function createSql(connectionString: string) {
  return postgres(connectionString, { max: 10, prepare: false });
}

export type Sql = ReturnType<typeof createSql>;
