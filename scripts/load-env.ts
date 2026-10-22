import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

/** Load `.env.local` then `.env` from repo root (does not override existing process.env). */
export function loadLocalEnv(cwd = process.cwd()): void {
  const local = resolve(cwd, ".env.local");
  const plain = resolve(cwd, ".env");
  if (existsSync(local)) config({ path: local });
  if (existsSync(plain)) config({ path: plain });
}
