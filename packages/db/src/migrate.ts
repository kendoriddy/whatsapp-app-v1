import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
for (const name of [".env.local", ".env"]) {
  const p = resolve(repoRoot, name);
  if (existsSync(p)) config({ path: p });
}

const dir = join(here, "../migrations");

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL_DIRECT or DATABASE_URL required (set in .env.local; copy from .env.example)",
    );
  }
  const sql = postgres(url, { max: 1 });
  await sql`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const [{ exists }] = await sql<
      { exists: boolean }[]
    >`select exists(select 1 from schema_migrations where id = ${file}) as exists`;
    if (exists) {
      console.log(`skip ${file}`);
      continue;
    }
    const body = readFileSync(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (id) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
