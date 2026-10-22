import http from "k6/http";
import { check } from "k6";
import crypto from "k6/crypto";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300"],
  },
};

const secret = __ENV.META_APP_SECRET || "local-app-secret-change-me";
const base = __ENV.APP_BASE_URL || "http://localhost:3000";

export default function () {
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "2349079207221", phone_number_id: "local-phone-number-id" },
              contacts: [{ profile: { name: "Load" }, wa_id: "2348000999999" }],
              messages: [
                {
                  from: "2348000999999",
                  id: `wamid.LOAD.${__VU}.${__ITER}.${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "load test" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const sig = `sha256=${crypto.hmac("sha256", payload, secret, "hex")}`;
  const res = http.post(`${base}/api/webhooks/whatsapp`, payload, {
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig },
  });
  check(res, { "status 200": (r) => r.status === 200 });
}
