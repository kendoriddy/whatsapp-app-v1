-- Knowledge bank: chunked retrieval, file metadata, RLS, private Storage bucket

do $$ begin
  create type knowledge_doc_status as enum ('processing', 'ready', 'failed');
exception when duplicate_object then null;
end $$;

alter table knowledge_doc
  add column if not exists status knowledge_doc_status not null default 'ready',
  add column if not exists error text,
  add column if not exists storage_path text,
  add column if not exists byte_size integer;

create table if not exists knowledge_chunk (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references knowledge_doc(id) on delete cascade,
  ordinal integer not null,
  markdown text not null,
  search_vector tsvector not null,
  created_at timestamptz not null default now(),
  unique (doc_id, ordinal)
);

create index if not exists knowledge_chunk_doc_idx on knowledge_chunk (doc_id, ordinal);
create index if not exists knowledge_chunk_search_idx on knowledge_chunk using gin (search_vector);

-- Backfill chunks for any existing ready docs (empty bank is fine).
insert into knowledge_chunk (doc_id, ordinal, markdown, search_vector)
select
  d.id,
  0,
  d.markdown,
  setweight(to_tsvector('english', coalesce(d.title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(d.markdown, '')), 'B')
from knowledge_doc d
where d.status = 'ready'
  and length(trim(d.markdown)) > 0
  and not exists (select 1 from knowledge_chunk c where c.doc_id = d.id);

-- Require knowledge before Merlin invents business facts.
update automation_setting
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{require_knowledge}',
  'true'::jsonb,
  true
)
where key = 'auto_send.merlin_replies';

-- RLS: desk uses DATABASE_URL (table owner / bypass). Deny anon + authenticated.
do $$
declare t text;
begin
  for t in select unnest(array['knowledge_doc', 'knowledge_chunk'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists deny_all_anon on %I', t);
    execute format('drop policy if exists deny_all_auth on %I', t);
    execute format(
      'create policy deny_all_anon on %I for all to anon using (false) with check (false)',
      t
    );
    execute format(
      'create policy deny_all_auth on %I for all to authenticated using (false) with check (false)',
      t
    );
  end loop;
exception when undefined_object then
  -- roles anon/authenticated may not exist outside Supabase
  null;
end $$;

-- Private Storage bucket for original knowledge files (service-role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge',
  'knowledge',
  false,
  12582912,
  null
)
on conflict (id) do update set public = false;
