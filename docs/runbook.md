# MMABON Order Desk runbook

## Rotate Meta system-user token

1. Business settings → System users → Generate token (Never, WhatsApp permissions).
2. Update `META_SYSTEM_USER_TOKEN` on web + worker hosts.
3. Confirm Settings → WhatsApp token health / send a test template.

## Rotate App Secret

1. Meta App Dashboard → App settings → Basic → Reset App Secret.
2. Update `META_APP_SECRET` (webhook signatures will fail until updated).
3. Re-verify webhook subscription.

## Pause all sends

Set feature flag `sends.paused` = true (Settings → flags). `sendOutbound` throws `SENDS_PAUSED`.

## Swap WhatsApp number (test → MMABON)

Follow `spec-v2.md` §23. Settings → WhatsApp → Refresh from Meta → Set as sending number.

## Replay DLQ / reprocess webhook

```bash
pnpm tsx scripts/reprocess-event.ts --id <webhookEventId>
```

## Merlin auto-reply + knowledge bank

1. **Settings → Merlin** → turn **Merlin auto-reply ON** (writes `auto_send.merlin_replies` + `ai.merlin_auto_reply`; default OFF per R-2).
2. Upload FAQs / price lists / policies (`.md`, `.txt`, `.csv`, `.html`, `.json`, `.docx`, `.pdf`). Files are extracted to markdown in `knowledge_doc`.
3. Inbound messages are classified, then Merlin may auto-send a grounded reply (`origin=ai_suggestion`, `auto_sent=true`) only while the toggle is on and the 24h window is open.
4. Turn the toggle **OFF** to stop auto-replies immediately. Disable or delete individual docs to remove them from context.

## Paystack

Use test keys in local/staging; live keys in production. Feature flags `orders.module` and `payments.paystack` must be **on** (Settings → Feature flags).

### Webhook URL (Paystack dashboard)

1. Open [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings** → **API Keys & Webhooks** (or **Developer** → **Webhooks**).
2. Set **Webhook URL** to:
   ```
   https://whatsapp-app-v1.vercel.app/api/webhooks/paystack
   ```
   (General form: `${APP_BASE_URL}/api/webhooks/paystack`.)
3. **Live callback URL** (customer browser redirect after checkout — not the webhook):
   ```
   https://whatsapp-app-v1.vercel.app/pay/thanks
   ```
   Same value as env `PAYSTACK_CALLBACK_URL`. Paystack appends `?reference=…` / `trxref=…`; the thanks page shows paid amount + **remaining balance**.
4. Save. Use the **same mode** as your secret key (`sk_test_…` → Test; `sk_live_…` → Live).
5. Optional: send a test webhook and confirm a `webhook_event` row with `source='paystack'`.
6. Ensure Vercel env has `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`, and `PAYSTACK_FALLBACK_EMAIL_DOMAIN`.

Staff flow: conversation → **Create invoice** → set total + advance (full / deposit % / deposit ₦) → optional **Ask Merlin to fill** → **Create invoice & send link**. Paystack charges only the advance; receipt (browser + WhatsApp) shows remaining.
