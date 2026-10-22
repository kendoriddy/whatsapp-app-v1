import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";
import { getSql } from "@/lib/db";
import { verifyPaystackSignature, PAYSTACK_IPS } from "@mmabon/paystack";
import { createPgBossQueue, Jobs } from "@mmabon/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const env = getEnv();
  if (env.PAYSTACK_ENFORCE_IP_ALLOWLIST) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip && !(PAYSTACK_IPS as readonly string[]).includes(ip)) {
      return new Response(null, { status: 401 });
    }
  }

  const raw = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("x-paystack-signature");
  const valid = verifyPaystackSignature(raw, sig, env.PAYSTACK_SECRET_KEY);
  if (!valid) return new Response(null, { status: 401 });

  const body = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  const dedupeKey = createHash("sha256").update(raw).digest("hex");
  const sql = getSql();
  const rows = await sql<{ id: number }[]>`
    insert into webhook_event (source, dedupe_key, signature_valid, headers, body)
    values ('paystack', ${dedupeKey}, true, ${sql.json({})}, ${sql.json(body as never)})
    on conflict (source, dedupe_key) do nothing
    returning id
  `;

  if (rows[0]?.id) {
    const queue = createPgBossQueue(env.DATABASE_URL_DIRECT);
    await queue.start().catch(() => undefined);
    await queue.send(Jobs.PAYSTACK_PROCESS_EVENT, {
      webhookEventId: rows[0].id,
    });
  }
  return new Response(null, { status: 200 });
}
