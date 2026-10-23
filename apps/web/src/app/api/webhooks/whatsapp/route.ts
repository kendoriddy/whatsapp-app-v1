import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";
import { getSql } from "@/lib/db";
import { getQueue } from "@/lib/queue";
import { processWebhookInline } from "@/lib/run-wa-jobs";
import { timingSafeEqualString, verifyMetaSignature } from "@mmabon/whatsapp";
import { Jobs } from "@mmabon/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Handshake only needs the verify token — avoid failing Meta Verify when other
  // staging secrets are still placeholders (POST still uses full getEnv()).
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    expected &&
    expected.length >= 16 &&
    timingSafeEqualString(token, expected) &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const env = getEnv();
  const raw = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("x-hub-signature-256");
  const valid = verifyMetaSignature(raw, sig, env.META_APP_SECRET);
  const dedupeKey = createHash("sha256").update(raw).digest("hex");

  if (!valid) {
    const sql = getSql();
    await sql`
      insert into webhook_event (source, dedupe_key, signature_valid, headers, body)
      values ('meta', ${dedupeKey + "-invalid-" + Date.now()}, false, ${sql.json({ "x-hub-signature-256": sig })}, ${sql.json(JSON.parse(raw.toString("utf8") || "{}") as never)})
    `.catch(() => undefined);
    return new Response(null, { status: 401 });
  }

  const body = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  const sql = getSql();

  const rows = await sql<{ id: number }[]>`
    insert into webhook_event (source, dedupe_key, signature_valid, headers, body)
    values (
      'meta',
      ${dedupeKey},
      true,
      ${sql.json({ "content-type": req.headers.get("content-type") })},
      ${sql.json(body as never)}
    )
    on conflict (source, dedupe_key) do nothing
    returning id
  `;

  const webhookEventId = rows[0]?.id;
  if (webhookEventId) {
    // Prefer in-request processing so messages aren't dropped when pg-boss /
    // the worker can't get a session-pooler connection on Vercel.
    try {
      await processWebhookInline(webhookEventId);
    } catch (err) {
      console.error("[webhook] inline process failed", err);
      try {
        const queue = await getQueue();
        await queue.send(
          Jobs.WA_PROCESS_EVENT,
          { webhookEventId },
          {
            singletonKey: `wa-evt-${webhookEventId}`,
            retryLimit: 10,
            retryBackoff: true,
          },
        );
      } catch (enqueueErr) {
        console.error("[webhook] enqueue failed", enqueueErr);
      }
    }
  }

  return new Response(null, { status: 200 });
}
