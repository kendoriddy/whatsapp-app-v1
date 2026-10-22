#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { signMetaPayload } from "../packages/whatsapp/src/signature.ts";

const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7) ?? process.argv[process.argv.indexOf("--file") + 1];
const target = process.argv.find((a) => a.startsWith("--target="))?.slice(9) ?? process.argv[process.argv.indexOf("--target") + 1] ?? "http://localhost:3000";
const phoneNumberId = process.env.META_PHONE_NUMBER_ID ?? "local-phone-number-id";
const secret = process.env.META_APP_SECRET ?? "local-app-secret-change-me";

if (!file) {
  console.error("Usage: pnpm fixtures:replay --file fixtures/conversations/A_scattered.yaml --target http://localhost:3000");
  process.exit(1);
}

const doc = parseYaml(readFileSync(file, "utf8")) as {
  id: string;
  contact: { wa_id: string; profile_name: string };
  messages: Array<{ at: string; from: string; type: string; text?: string }>;
};

let n = 0;
for (const m of doc.messages) {
  if (m.from !== "customer") continue;
  n += 1;
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
                phone_number_id: phoneNumberId,
              },
              contacts: [{ profile: { name: doc.contact.profile_name }, wa_id: doc.contact.wa_id }],
              messages: [
                {
                  from: doc.contact.wa_id,
                  id: `wamid.FIXTURE.${doc.id}.${n}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: m.type,
                  text: m.type === "text" ? { body: m.text } : undefined,
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const raw = Buffer.from(JSON.stringify(payload));
  const sig = signMetaPayload(raw, secret);
  const res = await fetch(`${target}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": sig },
    body: raw,
  });
  console.log(m.text?.slice(0, 40), res.status);
}

console.log(`Replayed ${n} messages from ${file}`);
