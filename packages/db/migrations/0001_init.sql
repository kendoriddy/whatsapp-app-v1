-- MMABON Order Desk — canonical schema (spec §7)

create extension if not exists "pgcrypto";

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create type app_role            as enum ('admin','sales','designer','production','dispatch','manager');
create type msg_direction       as enum ('inbound','outbound');
create type msg_type            as enum ('text','image','audio','video','document','sticker','location',
                                         'contacts','interactive','button','reaction','template','unsupported');
create type msg_status          as enum ('received','accepted','sent','delivered','read','failed');
create type msg_class           as enum ('inquiry','complaint','order','spam');
create type conversation_status as enum ('open','snoozed','closed');
create type media_status        as enum ('pending','downloading','stored','failed','expired');
create type outbound_kind       as enum ('text','media','template');
create type outbound_origin     as enum ('staff_composed','ai_suggestion','followup','quote','payment_link','system_auto');
create type outbound_status     as enum ('draft','pending_approval','approved','rejected','sending','sent','failed','cancelled');
create type webhook_source      as enum ('meta','paystack');
create type template_status     as enum ('APPROVED','PENDING','REJECTED','PAUSED','DISABLED','IN_APPEAL','LIMIT_EXCEEDED','UNKNOWN');
create type template_category   as enum ('MARKETING','UTILITY','AUTHENTICATION');
create type order_stage         as enum ('new_enquiry','awaiting_details','quoted','negotiating','confirmed',
                                         'paid','in_production','fulfilled','lost');
create type waiting_on          as enum ('none','customer_details','customer_decision','customer_approval','internal');
create type field_status        as enum ('confirmed','provisional','assumed','missing');
create type set_by              as enum ('ai','staff','rule');
create type risk_level          as enum ('ok','watch','at_risk','late','unknown');
create type change_kind         as enum ('brief_created','field_change','line_item_added','line_item_removed',
                                         'variant_change','stage_change','quote_created','quote_superseded',
                                         'payment','substitution','note');
create type actor_kind          as enum ('staff','ai','system','customer');
create type quote_status        as enum ('draft','sent','accepted','rejected','expired','superseded');
create type payment_kind        as enum ('deposit','balance','full');
create type payment_status      as enum ('created','link_sent','paid','failed','abandoned','amount_mismatch','cancelled');
create type followup_reason     as enum ('awaiting_details','quote_no_reply','artwork_approval','balance_due','pickup','feedback','manual');
create type followup_status     as enum ('open','done','snoozed','dismissed');
create type clarif_status       as enum ('open','asked','answered','dismissed');
create type wa_phone_lifecycle  as enum ('pending','connected','retired');

-- Relies on Supabase Auth's auth.users (do not create/alter auth schema here).

create table staff_user (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        app_role not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger staff_user_updated before update on staff_user for each row execute function set_updated_at();

create table wa_phone_number (
  id                       uuid primary key default gen_random_uuid(),
  phone_number_id          text not null unique,
  display_phone_number     text not null,
  waba_id                  text not null,
  label                    text not null,
  lifecycle                wa_phone_lifecycle not null default 'pending',
  is_active                boolean not null default false,
  verified_name            text,
  name_status              text,
  code_verification_status text,
  quality_rating           text,
  messaging_limit_tier     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index wa_phone_number_one_active on wa_phone_number (is_active) where is_active = true;
create trigger wa_phone_number_updated before update on wa_phone_number for each row execute function set_updated_at();

create table contact (
  id            uuid primary key default gen_random_uuid(),
  wa_id         text not null unique,
  e164          text not null,
  profile_name  text,
  display_name  text,
  email         text,
  notes         text,
  is_blocked    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contact_updated before update on contact for each row execute function set_updated_at();

create table conversation (
  id                    uuid primary key default gen_random_uuid(),
  contact_id            uuid not null references contact(id),
  wa_phone_number_id    uuid not null references wa_phone_number(id),
  status                conversation_status not null default 'open',
  snoozed_until         timestamptz,
  assigned_to           uuid references staff_user(id),
  last_inbound_at       timestamptz,
  last_outbound_at      timestamptz,
  last_message_at       timestamptz,
  last_message_preview  text,
  last_inbound_class    msg_class,
  unread_count          integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, wa_phone_number_id)
);
create index conversation_last_message_idx on conversation (last_message_at desc);
create trigger conversation_updated before update on conversation for each row execute function set_updated_at();

create table webhook_event (
  id               bigserial primary key,
  source           webhook_source not null,
  dedupe_key       text not null,
  signature_valid  boolean not null,
  headers          jsonb not null,
  body             jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  process_error    text,
  unique (source, dedupe_key)
);

create table media_asset (
  id              uuid primary key default gen_random_uuid(),
  wa_media_id     text,
  mime_type       text,
  sha256_meta     text,
  file_size       bigint,
  storage_path    text,
  status          media_status not null default 'pending',
  attempts        integer not null default 0,
  last_error      text,
  downloaded_at   timestamptz,
  wa_id_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger media_asset_updated before update on media_asset for each row execute function set_updated_at();

create table message_template (
  id              uuid primary key default gen_random_uuid(),
  wa_template_id  text unique,
  name            text not null,
  language        text not null,
  category        template_category not null,
  status          template_status not null,
  components      jsonb not null,
  param_count     integer not null default 0,
  synced_at       timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, language)
);
create trigger message_template_updated before update on message_template for each row execute function set_updated_at();

create table automation_setting (
  key            text primary key,
  enabled        boolean not null default false,
  allowed_origin outbound_origin not null,
  config         jsonb not null default '{}',
  description    text not null,
  updated_by     uuid references staff_user(id),
  updated_at     timestamptz not null default now()
);

create table feature_flag (
  key          text primary key,
  enabled      boolean not null default false,
  description  text not null,
  updated_by   uuid references staff_user(id),
  updated_at   timestamptz not null default now()
);

create table outbound_message (
  id                      uuid primary key default gen_random_uuid(),
  conversation_id         uuid not null references conversation(id),
  kind                    outbound_kind not null,
  body_text               text check (char_length(body_text) <= 4096),
  media_asset_id          uuid references media_asset(id),
  media_caption           text check (char_length(media_caption) <= 1024),
  template_id             uuid references message_template(id),
  template_params         jsonb,
  origin                  outbound_origin not null,
  ai_run_id               uuid,
  order_id                uuid,
  status                  outbound_status not null default 'draft',
  created_by              uuid references staff_user(id),
  approved_by             uuid references staff_user(id),
  approved_at             timestamptz,
  rejected_by             uuid references staff_user(id),
  rejected_reason         text,
  auto_sent               boolean not null default false,
  automation_setting_key  text references automation_setting(key),
  idempotency_key         text not null unique,
  send_attempts           integer not null default 0,
  last_error_code         integer,
  last_error              text,
  needs_manual_check      boolean not null default false,
  wamid                   text unique,
  sent_at                 timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'text' or body_text is not null),
  check (kind <> 'media' or media_asset_id is not null),
  check (kind <> 'template' or template_id is not null),
  check (not auto_sent or automation_setting_key is not null)
);
create trigger outbound_message_updated before update on outbound_message for each row execute function set_updated_at();

create table message (
  id                     uuid primary key default gen_random_uuid(),
  conversation_id        uuid not null references conversation(id),
  wamid                  text unique,
  direction              msg_direction not null,
  type                   msg_type not null,
  text_body              text,
  caption                text,
  media_asset_id         uuid references media_asset(id),
  context_wamid          text,
  reaction_emoji         text,
  location               jsonb,
  wa_timestamp           timestamptz not null,
  received_at            timestamptz not null default now(),
  status                 msg_status not null,
  error_code             integer,
  error_title            text,
  error_detail           text,
  outbound_message_id    uuid references outbound_message(id),
  sent_by                uuid references staff_user(id),
  classification               msg_class,
  classification_confidence    numeric(4,3) check (classification_confidence between 0 and 1),
  classification_model         text,
  classification_prompt_version text,
  classification_ai_run_id     uuid,
  classified_at                timestamptz,
  classification_needs_review  boolean not null default false,
  classification_override      msg_class,
  classification_override_by   uuid references staff_user(id),
  classification_override_at   timestamptz,
  urgency                text check (urgency in ('low','normal','high')),
  urgency_ai_run_id      uuid,
  transcript             text,
  transcript_ai_run_id   uuid,
  media_description      text,
  media_description_ai_run_id uuid,
  raw                    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((direction = 'inbound' and status = 'received') or (direction = 'outbound' and status <> 'received')),
  check (direction = 'inbound' or classification is null)
);
create index message_conversation_ts_idx on message (conversation_id, wa_timestamp);
create index message_class_idx on message (classification) where direction = 'inbound';
create trigger message_updated before update on message for each row execute function set_updated_at();

create table message_status_event (
  id            bigserial primary key,
  wamid         text not null,
  status        text not null,
  wa_timestamp  timestamptz not null,
  recipient_id  text,
  errors        jsonb,
  pricing       jsonb,
  conversation  jsonb,
  raw           jsonb not null,
  created_at    timestamptz not null default now(),
  unique (wamid, status, wa_timestamp)
);

create table ai_run (
  id                 uuid primary key default gen_random_uuid(),
  step_key           text not null,
  step_version       text not null,
  provider           text not null,
  model              text not null,
  prompt_version     text not null,
  subject_type       text not null,
  subject_id         uuid not null,
  input_hash         text not null,
  input              jsonb not null,
  output             jsonb,
  valid              boolean not null,
  validation_errors  jsonb not null default '[]',
  latency_ms         integer,
  tokens_in          integer,
  tokens_out         integer,
  cost_usd_micros    bigint,
  created_at         timestamptz not null default now()
);
create index ai_run_subject_idx on ai_run (subject_type, subject_id);

create table audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor_kind   actor_kind not null,
  actor_id     uuid,
  action       text not null,
  entity_type  text not null,
  entity_id    text not null,
  before       jsonb,
  after        jsonb,
  ip           inet,
  user_agent   text
);
create index audit_entity_idx on audit_log (entity_type, entity_id);

create table api_idempotency (
  key         text primary key,
  user_id     uuid not null references staff_user(id),
  status_code integer not null,
  response    jsonb not null,
  created_at  timestamptz not null default now()
);

create function outbound_guard() returns trigger language plpgsql as $$
declare send_roles app_role[] := array['admin','sales','manager']::app_role[];
        r app_role; s automation_setting;
begin
  if new.status in ('sending','sent') and (old.status is distinct from new.status) then
    if new.auto_sent then
      select * into s from automation_setting where key = new.automation_setting_key;
      if s is null or not s.enabled or s.allowed_origin <> new.origin then
        raise exception 'R2_SETTING_DISABLED';
      end if;
    else
      select role into r from staff_user where id = new.approved_by and active;
      if new.approved_by is null or r is null or not (r = any(send_roles)) then
        raise exception 'R2_NOT_APPROVED';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger outbound_guard_trg before update on outbound_message
  for each row execute function outbound_guard();

create table orders (
  id                        uuid primary key default gen_random_uuid(),
  ref                       text not null unique,
  contact_id                uuid not null references contact(id),
  conversation_id           uuid not null references conversation(id),
  stage                     order_stage not null default 'new_enquiry',
  waiting_on                waiting_on not null default 'none',
  owner_id                  uuid references staff_user(id),
  event_date                date,
  need_by                   date,
  budget_kobo               bigint,
  risk_level                risk_level not null default 'unknown',
  risk_reasons              jsonb not null default '[]',
  lost_reason               text,
  last_customer_contact_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_updated before update on orders for each row execute function set_updated_at();
alter table outbound_message add constraint outbound_order_fk foreign key (order_id) references orders(id);

create table default_rule (
  id          uuid primary key default gen_random_uuid(),
  field_key   text not null,
  value       jsonb not null,
  applies_to  jsonb not null default '{}',
  enabled     boolean not null default false,
  created_by  uuid references staff_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_field (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  key                   text not null,
  value                 jsonb,
  status                field_status not null,
  evidence_message_ids  uuid[] not null default '{}',
  default_rule_id       uuid references default_rule(id),
  set_by                set_by not null,
  ai_run_id             uuid references ai_run(id),
  confirmed_by          uuid references staff_user(id),
  note                  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, key),
  check ((status = 'missing') = (value is null)),
  check (status <> 'assumed' or default_rule_id is not null),
  check (status in ('missing','assumed') or set_by = 'staff' or cardinality(evidence_message_ids) >= 1)
);

create table order_line_item (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_code  text,
  product_label text not null,
  attributes    jsonb not null default '{}',
  removed_at    timestamptz,
  sort          integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_variant (
  id            uuid primary key default gen_random_uuid(),
  line_item_id  uuid not null references order_line_item(id) on delete cascade,
  colour        text,
  cut           text,
  qty           integer check (qty is null or qty > 0),
  status        field_status not null,
  evidence_message_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_size_qty (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references order_variant(id) on delete cascade,
  size        text not null,
  qty         integer check (qty is null or qty >= 0),
  status      field_status not null,
  evidence_message_ids uuid[] not null default '{}'
);

create table personalisation_entry (
  id           uuid primary key default gen_random_uuid(),
  variant_id   uuid references order_variant(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  person_label text,
  back_text    text,
  size         text,
  status       field_status not null,
  evidence_message_ids uuid[] not null default '{}'
);

create table clarification_question (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  field_key          text not null,
  question_text      text not null,
  priority           integer not null,
  status             clarif_status not null default 'open',
  asked_outbound_id  uuid references outbound_message(id),
  answer_message_id  uuid references message(id),
  ai_run_id          uuid references ai_run(id),
  created_at timestamptz not null default now()
);

create table change_event (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  at                  timestamptz not null default now(),
  actor_kind          actor_kind not null,
  actor_id            uuid,
  source_message_id   uuid references message(id),
  kind                change_kind not null,
  target              text,
  before              jsonb,
  after               jsonb,
  reason              text,
  needs_customer_ack  boolean not null default false,
  customer_ack_message_id uuid references message(id),
  notify_roles        app_role[] not null default '{}',
  acknowledged        jsonb not null default '{}'
);
create index change_event_order_idx on change_event (order_id, at);

create table quote (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  ref            text not null,
  version        integer not null,
  status         quote_status not null default 'draft',
  items          jsonb not null,
  subtotal_kobo  bigint not null,
  delivery_kobo  bigint not null default 0,
  discount_kobo  bigint not null default 0,
  total_kobo     bigint not null,
  valid_until    date,
  sent_outbound_id uuid references outbound_message(id),
  created_by     uuid references staff_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, version),
  unique (ref, version),
  check (total_kobo = subtotal_kobo + delivery_kobo - discount_kobo)
);

create table price_rule (
  id            uuid primary key default gen_random_uuid(),
  product_code  text not null,
  decoration    text,
  min_qty       integer not null,
  max_qty       integer,
  unit_kobo     bigint not null,
  addons        jsonb not null default '{}',
  valid_from    date not null,
  valid_to      date,
  enabled       boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_time_rule (
  id              uuid primary key default gen_random_uuid(),
  product_code    text not null,
  process         text not null,
  units_per_day   integer not null check (units_per_day > 0),
  setup_days      numeric(4,1) not null default 0,
  artwork_days    numeric(4,1) not null default 0,
  enabled         boolean not null default true
);

create table capacity_day (
  day             date not null,
  process         text not null,
  capacity_units  integer not null,
  booked_units    integer not null default 0,
  primary key (day, process)
);

create table payment_request (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id),
  quote_id            uuid not null references quote(id),
  kind                payment_kind not null,
  amount_kobo         bigint not null check (amount_kobo > 0),
  currency            text not null default 'NGN' check (currency = 'NGN'),
  paystack_reference  text not null unique,
  paystack_access_code text,
  authorization_url   text,
  customer_email_used text not null,
  status              payment_status not null default 'created',
  paid_at             timestamptz,
  channel             text,
  fees_kobo           bigint,
  verified_at         timestamptz,
  raw_verify          jsonb,
  link_outbound_id    uuid references outbound_message(id),
  created_by          uuid references staff_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table followup (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid references orders(id) on delete cascade,
  conversation_id    uuid not null references conversation(id),
  reason             followup_reason not null,
  due_at             timestamptz not null,
  draft_outbound_id  uuid references outbound_message(id),
  status             followup_status not null default 'open',
  snoozed_until      timestamptz,
  done_at            timestamptz,
  created_by_kind    actor_kind not null,
  created_by         uuid references staff_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index followup_due_idx on followup (status, due_at);

-- RLS
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'staff_user','wa_phone_number','contact','conversation','webhook_event','media_asset',
      'message','message_status_event','message_template','outbound_message','automation_setting',
      'feature_flag','ai_run','audit_log','api_idempotency','orders','default_rule','order_field',
      'order_line_item','order_variant','order_size_qty','personalisation_entry','clarification_question',
      'change_event','quote','price_rule','lead_time_rule','capacity_day','payment_request','followup'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy deny_all_anon on %I for all to anon using (false) with check (false)', t);
    execute format('create policy deny_all_auth on %I for all to authenticated using (false) with check (false)', t);
  end loop;
exception when undefined_object then
  -- roles anon/authenticated may not exist outside Supabase; skip policies
  null;
end $$;

do $$
begin
  create policy staff_user_self_select on staff_user for select to authenticated
    using (id = auth.uid());
exception when undefined_object or undefined_function then
  null;
end $$;
