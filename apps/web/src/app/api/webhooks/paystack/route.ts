import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";
import { getSql } from "@/lib/db";
import { verifyPaystackSignature, PAYSTACK_IPS } from "@mmabon/paystack";
import { Jobs } from "@mmabon/queue";
import { getQueue } from "@/lib/queue";
import { processPaystackInline } from "@/lib/run-wa-jobs";

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

  const webhookEventId = rows[0]?.id;
  if (webhookEventId) {
    try {
      await processPaystackInline(webhookEventId);
    } catch (err) {
      console.error("[paystack webhook] inline process failed", err);
      try {
        const queue = await getQueue();
        await queue.send(
          Jobs.PAYSTACK_PROCESS_EVENT,
          { webhookEventId },
          {
            singletonKey: `ps-evt-${webhookEventId}`,
            retryLimit: 10,
            retryBackoff: true,
          },
        );
      } catch (enqueueErr) {
        console.error("[paystack webhook] enqueue failed", enqueueErr);
      }
    }
  }
  return new Response(null, { status: 200 });
}
