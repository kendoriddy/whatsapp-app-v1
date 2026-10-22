# Demo script

1. Replay `fixtures/conversations/A_scattered.yaml` into staging webhook.
2. Open Inbox — messages appear with classification.
3. Reply from thread inside the 24h window — ticks update via status webhooks.
4. Create order from conversation (enable `orders.module`).
5. Build quote manually → send payment link (Paystack test).
6. Show Settings → WhatsApp numbers and activate switch (no redeploy).
7. Toggle `ai.extract_brief` on staging only if R-1 eval passes.
