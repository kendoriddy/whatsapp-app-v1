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

Use test keys in local/staging. Webhook: `${APP_BASE_URL}/api/webhooks/paystack`.
