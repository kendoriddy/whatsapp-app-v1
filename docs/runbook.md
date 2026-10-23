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

## Paystack

Use test keys in local/staging; live keys in production. Feature flags `orders.module` and `payments.paystack` must be **on** (Settings → Feature flags).

### Webhook URL (Paystack dashboard)

1. Open [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings** → **API Keys & Webhooks** (or **Developer** → **Webhooks**).
2. Set **Webhook URL** to:
   ```
   https://whatsapp-app-v1.vercel.app/api/webhooks/paystack
   ```
   (General form: `${APP_BASE_URL}/api/webhooks/paystack`.)
3. Save. Use the **same mode** as your secret key (`sk_test_…` → Test webhook; `sk_live_…` → Live webhook).
4. Optional: click **Send test webhook** / trigger a test `charge.success` and confirm a row appears in `webhook_event` with `source='paystack'`.
5. Ensure Vercel env has `PAYSTACK_SECRET_KEY` (HMAC key for `x-paystack-signature`), `PAYSTACK_CALLBACK_URL` (`…/pay/thanks`), and `PAYSTACK_FALLBACK_EMAIL_DOMAIN`.

Staff flow: open a conversation → **Create invoice** → amount → **Create invoice & send link**. Customer pays; Paystack POSTs `charge.success`; desk marks payment + order `paid`.
