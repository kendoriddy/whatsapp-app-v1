-- Knowledge bank + Merlin auto-reply automation

create table if not exists knowledge_doc (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_filename text not null,
  source_mime text not null,
  markdown text not null,
  char_count integer not null default 0,
  enabled boolean not null default true,
  created_by uuid references staff_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists knowledge_doc_enabled_idx on knowledge_doc (enabled, updated_at desc);

insert into feature_flag (key, enabled, description) values
  ('ai.merlin_auto_reply', false, 'Allow Merlin to draft/auto-answer from knowledge bank (paired with automation toggle)')
on conflict (key) do nothing;

insert into automation_setting (key, enabled, allowed_origin, config, description) values
  ('auto_send.merlin_replies', false, 'ai_suggestion',
   '{"skip_spam":true,"max_chars":900,"require_knowledge":false}',
   'When on, Merlin may auto-reply to inbound WhatsApp using the knowledge bank')
on conflict (key) do nothing;
