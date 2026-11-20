import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";

const port = Number(process.env.MOCK_GRAPH_PORT ?? 4010);
const webhookUrl =
  process.env.MOCK_GRAPH_WEBHOOK_URL ??
  "http://localhost:3000/api/webhooks/whatsapp";
const appSecret = process.env.META_APP_SECRET ?? "local-app-secret-change-me";

/** Valid 1×1 JPEG so browser <img> previews work in local fixtures. */
const MOCK_JPEG = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/media/pixel.jpg",
  ),
);
const MOCK_JPEG_SHA256 = createHash("sha256").update(MOCK_JPEG).digest("hex");

/** Media ids that should 404 once on the download URL, then succeed. */
const failOnceUrls = new Set<string>();

const app = Fastify({ logger: true });

/** More specific paths first so they do not collide with /:version/:id */
app.get("/:version/:wabaId/phone_numbers", async () => ({
  data: [
    {
      id: process.env.META_PHONE_NUMBER_ID ?? "local-phone-number-id",
      display_phone_number: "+2349079207221",
      verified_name: "MMABON Test",
      quality_rating: "GREEN",
      code_verification_status: "VERIFIED",
    },
  ],
}));

app.get("/:version/:wabaId/message_templates", async () => ({
  data: [
    {
      id: "tpl1",
      name: "followup_general",
      language: "en",
      category: "UTILITY",
      status: "APPROVED",
      components: [
        { type: "BODY", text: "Hello {{1}}, this is MMABON following up." },
      ],
    },
  ],
}));

app.post("/:version/:phoneNumberId/messages", async (req, reply) => {
  const body = req.body as { to?: string; type?: string };
  const wamid = `wamid.MOCK.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  void postStatuses(wamid, body.to ?? "000");
  return reply.send({
    messaging_product: "whatsapp",
    contacts: [{ input: body.to, wa_id: body.to }],
    messages: [{ id: wamid }],
  });
});

app.post("/:version/:phoneNumberId/register", async () => ({ success: true }));

app.get("/media-bytes/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  if (failOnceUrls.has(id)) {
    failOnceUrls.delete(id);
    return reply.code(404).send({ error: "not found" });
  }
  return reply.type("image/jpeg").send(MOCK_JPEG);
});

/** Test helper: next download of this media id returns 404 once. */
app.post("/_test/fail-once/:id", async (req) => {
  const { id } = req.params as { id: string };
  failOnceUrls.add(id);
  return { ok: true, id };
});

/**
 * Single handler for Graph object GET:
 * - media: `GET /{version}/{mediaId}?phone_number_id=...`
 * - phone: `GET /{version}/{phoneNumberId}`
 */
app.get("/:version/:objectId", async (req) => {
  const { objectId } = req.params as { objectId: string };
  const q = req.query as { phone_number_id?: string };
  if (q.phone_number_id) {
    return {
      url: `http://127.0.0.1:${port}/media-bytes/${objectId}`,
      mime_type: "image/jpeg",
      sha256: MOCK_JPEG_SHA256,
      file_size: MOCK_JPEG.byteLength,
      id: objectId,
      messaging_product: "whatsapp",
    };
  }
  return {
    id: objectId,
    status: "CONNECTED",
    platform_type: "CLOUD_API",
    display_phone_number: "+2349079207221",
    verified_name: "MMABON Test",
    quality_rating: "GREEN",
  };
});

async function postStatuses(wamid: string, recipient: string) {
  const { createHmac } = await import("node:crypto");
  for (const [status, delay] of [
    ["sent", 200],
    ["delivered", 1000],
    ["read", 3000],
  ] as const) {
    await new Promise((r) => setTimeout(r, delay));
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: process.env.META_WABA_ID ?? "local-waba-id",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "2349079207221",
                  phone_number_id:
                    process.env.META_PHONE_NUMBER_ID ?? "local-phone-number-id",
                },
                statuses: [
                  {
                    id: wamid,
                    status,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    recipient_id: recipient,
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const sig = `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`;
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sig,
        },
        body: raw,
      });
    } catch {
      /* ignore when web is down */
    }
  }
}

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`mock-graph on :${port}`);
});
