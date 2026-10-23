-- Seed feature flags, automation settings. Phone number seeded by app from env.

insert into feature_flag (key, enabled, description) values
  ('ai.classify', true, 'Classify inbound messages on ingest'),
  ('ai.suggest_reply', false, 'Suggest staff replies (P2)'),
  ('ai.urgency', false, 'Urgency scoring (P2)'),
  ('ai.extract_brief', false, 'Extract order brief (P2)'),
  ('ai.transcribe_audio', false, 'Transcribe voice notes (P2)'),
  ('ai.describe_image', false, 'Describe images (P2)'),
  ('orders.module', false, 'Orders domain'),
  ('payments.paystack', false, 'Paystack payment links'),
  ('followups.generator', false, 'Auto follow-up generator (P2)'),
  ('feasibility.engine', false, 'Deadline feasibility (P2)'),
  ('sends.paused', false, 'Kill switch: pause all outbound sends'),
  ('ai.merlin_auto_reply', false, 'Allow Merlin to draft/auto-answer from knowledge bank (paired with automation toggle)')
on conflict (key) do nothing;

insert into automation_setting (key, enabled, allowed_origin, config, description) values
  ('auto_send.read_receipts', false, 'system_auto', '{}', 'Send read receipts when staff open a thread'),
  ('auto_send.payment_received_ack', false, 'system_auto', '{"template_when_window_closed":"order_update"}', 'Auto thank-you on payment'),
  ('auto_send.out_of_hours_ack', false, 'system_auto', '{"hours":{"mon_sat":["08:00","19:00"]},"text":""}', 'Out-of-hours auto ack'),
  ('auto_send.followup_reminders', false, 'followup', '{"max_per_conversation":2}', 'Auto-send follow-up reminders'),
  ('auto_send.merlin_replies', false, 'ai_suggestion', '{"skip_spam":true,"max_chars":900,"require_knowledge":false}', 'When on, Merlin may auto-reply to inbound WhatsApp using the knowledge bank')
on conflict (key) do nothing;
