# MMABON Order Desk: Engineering Specification v2

|                   |                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document**      | `spec-v2.md`. This replaces `build-plan.md` as the source of truth for engineering                                                                               |
| **Status**        | Ready for handoff                                                                                                                                                |
| **Date**          | 17 Oct 2026 (WAT, UTC+1)                                                                                                                                         |
| **Product owner** | Kehinde Onifade (team: Daniel, Stella), Paystack Builder Challenge                                                                                               |
| **Client**        | MMABON Custom & Retail (Nigerian custom apparel; sells via WhatsApp)                                                                                             |
| **Audience**      | Any human developer or AI coding agent. Everything you need to build the system is in this document. Undecided items are listed **only** in §22 _Open Questions_ |

---

## 0. How to read this spec

- **MUST / MUST NOT / SHOULD / MAY** follow RFC 2119 meanings.
- IDs:
  - `R-n` = hard rule
  - `AC-xx-n` = acceptance criterion
  - `Q-n` = open question
  - `FF:` = feature flag key
  - `AS:` = automation setting key
- All times are stored in UTC (`timestamptz`) and displayed in **Africa/Lagos** (UTC+1).
- All money is stored as **integer kobo** (`bigint`); ₦1 = 100 kobo. Currency is always `NGN`.
- Phone numbers are stored in two forms:
  - `wa_id`: digits only, as Meta sends it (e.g. `2348031234567`)
  - `e164`: e.g. `+2348031234567`
- Code language: TypeScript (strict). Package manager: **pnpm**. Node **22 LTS**.
- If this spec conflicts with a third-party doc, the third-party doc wins for API wire formats. Record the discrepancy as a new `Q-n`.

### 0.1 Glossary

| Term                                   | Meaning                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloud API**                          | Meta's WhatsApp Business Cloud API (Graph API, `https://graph.facebook.com/{version}`)                                                                |
| **WABA**                               | WhatsApp Business Account (Meta object that owns phone numbers and templates)                                                                         |
| **Phone number ID**                    | Meta's ID for the registered business number (not the phone number itself)                                                                            |
| **wamid**                              | WhatsApp message ID (string, e.g. `wamid.HBgM...`), unique per message                                                                                |
| **Customer service window ("window")** | 24 h after the customer's most recent inbound message. Inside it, free-form messages are allowed. Outside it, only approved **templates** can be sent |
| **Template**                           | A Meta-approved message format (categories: `MARKETING`, `UTILITY`, `AUTHENTICATION`)                                                                 |
| **Outbound message**                   | Any message we intend to send to a customer. It always starts as a row in `outbound_message`                                                          |
| **Approval**                           | A staff action that authorises one specific outbound message to be sent                                                                               |
| **Pipeline step**                      | A pluggable AI processing unit (e.g. `classify`, `extract_brief`) that runs on ingest or on demand                                                    |
| **Brief**                              | Structured order details extracted from a conversation, with a per-field status and evidence                                                          |

---

## 1. Scope

### 1.1 Goals (what we are building)

1. **Live WhatsApp inbox.** Shared business number(s) registered **only** to the Cloud API on one WABA (pilot: `+2349079207221`; later MMABON’s production number — §8.1, §23). Every inbound customer message reaches our webhook, is stored, and appears on the staff dashboard within seconds (target p95 ≤ 5 s from Meta's POST to the dashboard).
2. **Staff replies from the dashboard.** Replies go out through Cloud API `POST /{phone-number-id}/messages` using the **conversation’s** Phone number ID. The 24 h window, templates, delivery statuses and media are handled correctly.
3. **AI on ingest.** Every inbound message is classified into exactly one of `inquiry | complaint | order | spam`, with a confidence score, model and prompt version. Classification is the first step of a **pluggable pipeline**. Later steps (suggested replies, urgency, brief extraction, transcription, image description) are added behind feature flags.
4. **Orders.** Briefs with per-field status (`confirmed | provisional | assumed | missing`) and evidence links, stages, change log, quotes, pricing rules, deadline feasibility, and follow-ups.
5. **Payments.** Quote → Paystack payment link → Paystack webhook → order marked paid.
6. **Production-grade architecture.** A fast webhook ingest (verify → persist → enqueue → 200), queue + workers, Postgres, object storage, realtime push, role-based staff auth, and an audit log.

### 1.2 Non-goals (out of scope; do NOT build)

- Any WhatsApp Business **app**, phone or linked device as a message source, and any import of historical chats. **The only message source is the Cloud API webhook.**
- WhatsApp group chats (the Cloud API number is used 1:1 with customers).
- A customer-facing chatbot that converses on its own.
- Voice/video calling.
- Marketing broadcast campaigns (they may come later; not in this spec).
- Multi-tenant SaaS (single tenant: MMABON).

### 1.3 Phasing

| Phase                         | Contents                                                                                                                                                      | Gate                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **P1 (weeks 1–4)**            | Ingest, inbox, thread view, replies, templates, statuses, media, classification, approvals, roles, audit, dashboard v1                                        | Must ship                                            |
| **P1b (week 5)**              | Orders (manual entry), quotes, pricing rules, Paystack                                                                                                        | Must ship                                            |
| **P2 (week 6, behind flags)** | `FF:ai.extract_brief`, `FF:ai.suggest_reply`, `FF:ai.urgency`, `FF:ai.transcribe_audio`, `FF:ai.describe_image`, `FF:followups.generator`, feasibility engine | Ship what passes its ACs; leave the rest flagged off |

---

## 2. Hard rules (non-negotiable, each has mandatory tests)

### R-1: The AI never fills in details the customer did not give

1. No AI step may write a value into any order field, line item, variant, size, personalisation entry, quote, or customer-facing draft unless that value is **grounded** in customer-sent or staff-entered content.
2. **Grounded** means one of:
   - **(a)** the value has ≥ 1 evidence `message.id` from the same conversation, _and_ it passes the grounding validator (§10.6); or
   - **(b)** it comes from an enabled row in `default_rule` (status `assumed`, and the row ID is stored); or
   - **(c)** it comes from an enabled `price_rule` / `lead_time_rule` (prices and lead times only, labelled as computed).
3. Any value that fails grounding MUST be dropped and the field set to `missing`, with `ai_run.validation_errors` recording `GROUNDING_FAILED`.
4. Images are **references only**. A vision description MAY populate `notes` and suggested _questions_. It MUST NOT populate product, fabric, colour, decoration, quantity, size, or price fields.
5. Suggested replies MUST NOT contain any ₦ amount, date, quantity or product attribute that is not in: the conversation, the order record, an approved quote, or a rule output. Violations → the suggestion is discarded.

**Mandatory tests** (Vitest, `tests/rules/r1-*.test.ts`):

- `r1-no-invented-fabric`: scenario A input → `fabric.status === 'missing'`.
- `r1-image-not-product`: scenario B input → `product.status === 'missing'` and `notes` contains the image description.
- `r1-grounding-drops-number`: mock the LLM to return `quantity: 100` when the evidence says "80" → stored value 80. A returned value with no matching evidence → `missing` + `GROUNDING_FAILED`.
- `r1-suggestion-price-guard`: mock a suggestion containing "₦5,000" with no quote/rule → the suggestion is rejected.
- `r1-assumed-requires-rule`: an LLM returning `status:'assumed'` with no enabled `default_rule` → coerced to `missing`.

### R-2: Nothing is sent to a customer without a human approving it, unless an explicit per-feature admin setting enables it (default OFF, audited)

1. **One function sends.** The only code path that calls the Graph `/messages` endpoint is `sendOutbound(outboundId)` in `packages/whatsapp/src/send.ts`, executed by the `wa.send_outbound` job. (Read receipts, `status: read`, are covered by **AS:read_receipts**, default off.)
2. `sendOutbound` MUST refuse (throw `R2_NOT_APPROVED`, set `status='failed'`, write an audit row) unless **one** of these holds:
   - **(a)** `outbound_message.status = 'approved'` AND `approved_by IS NOT NULL` AND the approver's role is in `SEND_ROLES` (`admin, sales, manager`); or
   - **(b)** `outbound_message.auto_sent = true` AND `automation_setting_key` refers to an `automation_setting` row with `enabled = true` **at send time** AND the origin matches that setting's `allowed_origin`.
3. When staff compose a message and click **Send**, that click is the approval: `approved_by = created_by`, and it is allowed only for `SEND_ROLES`. Other roles can only **Submit for approval**.
4. AI-generated drafts are always created with `status='pending_approval'` (or `'approved'` + `auto_sent=true` under rule 2(b)).
5. Every automation setting defaults to `enabled=false`. Only `admin` can change it. Every change writes `audit_log` (`action='automation_setting.update'`, with before/after). While any setting is enabled, the UI shows a persistent banner.
6. Database backstop: a `CHECK` constraint and trigger (§7, `outbound_guard`) reject `status IN ('sending','sent')` when the conditions in rule 2 are not met.

**Mandatory tests** (`tests/rules/r2-*.test.ts`):

- `r2-unapproved-not-sent`: a `pending_approval` row → the job throws, and the mock Graph server receives 0 requests.
- `r2-designer-cannot-send`: a designer POSTs `action:'send'` → 403, row in `pending_approval`.
- `r2-ai-draft-pending`: suggest_reply output → `pending_approval`.
- `r2-auto-send-default-off`: a fresh DB → all `automation_setting.enabled = false`.
- `r2-auto-send-disabled-midflight`: an auto outbound queued, then the setting disabled before the job runs → not sent, `failed` with `R2_SETTING_DISABLED`.
- `r2-audit-on-toggle`: toggling a setting creates an audit row with before/after.
- `r2-db-trigger`: a direct SQL update to `status='sending'` without approval → exception.

### R-3: Every AI output is traceable

Every AI step writes one `ai_run` row: step key + version, provider + model, prompt version, input hash, output, validation result, latency, tokens and cost. The `message` and `order_field` rows store `ai_run_id`.

**Test:** `r3-ai-run-written`.

### R-4: Exactly-once effects on at-least-once delivery

Both Meta and Paystack webhooks may arrive duplicated and out of order. Every handler MUST be idempotent:

- Messages: keyed on `wamid` (UNIQUE).
- Status events: keyed on `(wamid, status, wa_timestamp)` (UNIQUE).
- Payments: keyed on `paystack_reference` (UNIQUE).
- Events: `webhook_event.dedupe_key` (UNIQUE).

**Tests:** `r4-duplicate-message`, `r4-out-of-order-status`, `r4-duplicate-paystack`.

### R-5: Secrets

Secrets live only in environment variables on the server/worker. They never appear in client bundles, logs, the DB, or `audit_log`. CI runs `gitleaks`.

**Test:** `r5-no-secret-in-client-bundle`, a build-time grep for each secret's env var name in `.next/static`.

---

## 3. Architecture

### 3.1 Component diagram

```
                   ┌─────────────────────── Meta Cloud API ───────────────────────┐
 Customer ⇄ WhatsApp ⇄  POST webhook (messages, statuses, template updates)         │
                   │    ▲ Graph API: /messages, /media, /{media-id}, templates       │
                   └────┼──────────────────────────────────────────────────────────┘
                        │ HTTPS
┌───────────────────────┼─────────────────── apps/web (Next.js on Vercel) ───────────┐
│ GET/POST /api/webhooks/whatsapp  ── verify sig → INSERT webhook_event + enqueue → 200│
│ POST     /api/webhooks/paystack  ── verify sig → INSERT webhook_event + enqueue → 200│
│ /api/* (staff REST, Supabase Auth JWT, role checks)   UI (App Router, React)        │
└───────────────┬───────────────────────────────────────────────▲────────────────────┘
                │ SQL (pg) + pg-boss enqueue (same transaction)   │ Realtime (Broadcast)
        ┌───────▼────────────┐                         ┌──────────┴──────────┐
        │ Supabase Postgres  │◄────── SQL ────────────►│ apps/worker (Node 22│
        │  app schema +      │                         │  long-running, pg-   │
        │  pgboss schema     │                         │  boss consumers)     │
        └───────▲────────────┘                         └──┬───────┬───────┬──┘
                │                                          │       │       │
        ┌───────┴──────────┐                    Graph API ◄┘   LLM API  Paystack API
        │ Supabase Storage │◄──── media upload/download ───┘
        │ bucket wa-media  │
        └──────────────────┘
```

### 3.2 Flows

**F1: Inbound message**

1. Meta POSTs to `/api/webhooks/whatsapp`.
2. The handler reads the raw body, verifies `X-Hub-Signature-256`, and in one DB transaction:
   - inserts `webhook_event`
   - `pgboss.send('wa.process_event', {webhookEventId})`
3. It returns `200 OK`. Target p95 ≤ 300 ms; hard limit: always respond < 5 s.
4. The worker `wa.process_event` parses the event, then:
   - upserts `contact` and `conversation`
   - inserts `message ON CONFLICT (wamid) DO NOTHING`
   - if a row was inserted: updates the conversation counters, enqueues `wa.download_media` (if media) and `ai.classify_message`, and broadcasts `message.created`
5. The dashboard receives the broadcast and refetches the conversation/thread.

**F2: Outbound reply**

1. A staff member clicks Send.
2. `POST /api/conversations/:id/outbound`.
3. The `outbound_message` row is created as `approved` (sender role) and the `wa.send_outbound` job is enqueued.
4. The worker checks R-2 and the window, then calls Graph `/messages`.
5. On success it stores the `wamid`, creates the outbound `message` row (`status='accepted'`), and broadcasts.

**F3: Status update**

1. Meta POSTs `statuses[]`.
2. Same ingest path as F1.
3. `wa.process_event` inserts `message_status_event` (idempotent) and advances `message.status` by rank (§8.6).
4. Broadcast `message.status`.

**F4: Media**

1. `wa.download_media` calls `GET /{media-id}` and receives `url` (valid 5 min).
2. It downloads `url` with the bearer token, checks sha256, uploads to Storage, and sets `media_asset.status='stored'`.
3. Broadcast `media.stored`.

**F5: Payment**

1. Staff create a payment link from a quote.
2. The server calls Paystack `POST /transaction/initialize` and receives `authorization_url`.
3. An `outbound_message` draft containing the link is created; a staff member approves → it is sent.
4. Paystack later POSTs `charge.success` to `/api/webhooks/paystack`. The handler verifies `x-paystack-signature`, persists, enqueues, and returns 200.
5. The worker calls `GET /transaction/verify/:reference`, checks amount and currency, marks the payment paid, moves the order stage, logs a change event, and broadcasts.

### 3.3 Deployment topology

| Component                            | Host                                                                                                           | Notes                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/web`                           | Vercel (region `fra1`, closest to Lagos among Vercel regions with Supabase EU)                                 | Route handlers run on the Node.js runtime (not Edge), because we need the raw body and `crypto` |
| `apps/worker`                        | Render "Background Worker" (or Fly.io machine), 1 instance (scale to N; pg-boss supports concurrent consumers) | Long-running process. MUST NOT run on Vercel serverless                                         |
| Postgres + Auth + Storage + Realtime | Supabase project, region `eu-central-1` (Frankfurt)                                                            | Q-9 covers data residency                                                                       |
| `apps/mock-graph`                    | Local / CI only                                                                                                | Fake Graph API for tests and fixture replay                                                     |

Environments: `local`, `staging`, `production`. Each has its own Supabase project, Meta app config and Paystack keys (test keys in local/staging).

---

## 4. Technology stack (pinned)

Pin these exact major versions in `package.json` at project start. Versions were checked against npm on 17 Oct 2026.

| Concern                | Choice                                                                                                                         | Version                     | Why                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Web framework          | **Next.js** (App Router) + React                                                                                               | `next@16.x`                 | Team skill (JS/TS); route handlers + UI in one app                                                     |
| Language               | TypeScript strict                                                                                                              | `5.x`                       |                                                                                                        |
| DB                     | **Supabase Postgres** (PG 15+)                                                                                                 |                             | Managed Postgres + Auth + Storage + Realtime in one place; RLS                                         |
| DB access              | **Drizzle ORM** + `drizzle-kit` migrations; raw SQL allowed for triggers/RLS                                                   | `drizzle-orm@0.45.x`        | Typed SQL, SQL-first migrations                                                                        |
| Queue                  | **pg-boss**                                                                                                                    | `pg-boss@12.x`              | See §4.1                                                                                               |
| Realtime               | **Supabase Realtime Broadcast**                                                                                                | `@supabase/supabase-js@2.x` | See §4.2                                                                                               |
| Validation             | **Zod**                                                                                                                        | `zod@4.x`                   | One schema for API input, LLM JSON schema (via `z.toJSONSchema`) and output validation                 |
| LLM                    | OpenAI-compatible provider behind the `LlmClient` interface; Structured Outputs (`response_format: json_schema, strict: true`) | `openai@7.x`                | Strict JSON schema output; the interface allows swapping providers. The model is picked by eval (Q-12) |
| UI                     | Tailwind CSS 4 + shadcn/ui + TanStack Query + TanStack Table                                                                   |                             | Fast, accessible components                                                                            |
| Auth                   | Supabase Auth (email + password; invite-only)                                                                                  |                             | Built-in; JWT carries the user ID; role in `staff_user`                                                |
| Unit/integration tests | **Vitest**                                                                                                                     | `vitest@5.x`                |                                                                                                        |
| E2E tests              | **Playwright**                                                                                                                 | `@playwright/test@1.64.x`   |                                                                                                        |
| Load tests             | k6                                                                                                                             |                             | Webhook ingest SLO                                                                                     |
| Errors/logs            | Sentry (web + worker); structured JSON logs (pino)                                                                             |                             |                                                                                                        |
| Secrets scan           | gitleaks (CI)                                                                                                                  |                             | R-5                                                                                                    |

### 4.1 Queue choice: pg-boss (justification)

- **Transactional enqueue:** the job is inserted in the **same Postgres transaction** as `webhook_event`. Either both exist or neither does, so no event is ever lost between "saved" and "queued". (pg-boss accepts an external `db` executor for `send()`.)
- **No extra infrastructure:** no Redis or SaaS dependency, which means fewer moving parts for a 3-person team and lower cost in naira.
- **Built in:** retries with exponential backoff, `startAfter` delays, `singletonKey` de-duplication, cron schedules, dead-letter queues and job expiry.
- **Capacity:** MMABON's volume (hundreds to low thousands of messages a day) is far below Postgres-queue limits.
- **Upgrade path:** if volume grows past ~50 jobs/s sustained, swap the implementation behind `packages/queue` (interface `Queue.send/work/schedule`) for BullMQ + Redis. No business code changes.
- **Rejected:** BullMQ (needs Redis; no transactional enqueue with Postgres). Inngest/Trigger.dev (good, but adds an external dependency and makes the webhook path depend on a third party). Vercel cron + DB polling (poor retry semantics).

### 4.2 Realtime choice: Supabase Realtime Broadcast (justification)

- Workers publish small events **after commit** to channels via the server-side Supabase client using the service key. Clients subscribe with their JWT.
- **Payloads carry IDs only.** Clients refetch through `/api/*`, which enforces roles. So no data leaks through realtime, and RLS-filtered Postgres Changes (which scale poorly with many subscribers) are avoided.
- **Channels:** `inbox` (all staff), `conversation:{conversationId}`, `orders`, `approvals`, `system`.
- **Events** (payload: `{type, id, conversationId?, orderId?, at}`):

| Event                       | Channel(s)                       |
| --------------------------- | -------------------------------- |
| `message.created`           | `inbox`, `conversation:{id}`     |
| `message.status`            | `conversation:{id}`              |
| `message.classified`        | `inbox`, `conversation:{id}`     |
| `media.stored`              | `conversation:{id}`              |
| `conversation.updated`      | `inbox`                          |
| `outbound.pending_approval` | `approvals`                      |
| `outbound.updated`          | `conversation:{id}`, `approvals` |
| `order.updated`             | `orders`                         |
| `payment.paid`              | `orders`, `conversation:{id}`    |
| `system.alert`              | `system`                         |

- **Reconnect rule:** on (re)subscribe, the client refetches the visible lists, so missed events are harmless.

---

## 5. Repository layout

```
mmabon-desk/
├─ apps/
│  ├─ web/                 # Next.js app (UI + /api route handlers incl. webhooks)
│  ├─ worker/              # pg-boss consumers (Node 22). Entry: src/index.ts
│  └─ mock-graph/          # Fake Graph API (Fastify) for tests/replay
├─ packages/
│  ├─ db/                  # Drizzle schema, migrations (SQL), seed
│  ├─ queue/               # Queue interface + pg-boss implementation, job names/types
│  ├─ whatsapp/            # Graph client, webhook parsing (Zod), send.ts (R-2 gate), window.ts
│  ├─ paystack/            # Paystack client, signature verify, webhook parsing
│  ├─ ai/                  # LlmClient, pipeline registry, steps/*, prompts/*, validators/*
│  ├─ domain/              # orders, quotes, pricing, feasibility, followups, permissions
│  └─ shared/              # env (Zod-validated), logger, errors, money, time
├─ fixtures/
│  ├─ conversations/       # *.yaml sample conversations (anonymised/synthetic)
│  ├─ media/               # sample images/audio referenced by fixtures
│  └─ meta-payloads/       # raw Meta webhook JSON shapes for contract tests
├─ eval/
│  ├─ classification/      # labelled.jsonl, run.ts, reports/
│  └─ extraction/          # gold/*.json, run.ts, reports/
├─ tests/                  # rules/, integration/, contract/
├─ e2e/                    # Playwright specs incl. scenarios/A..E.spec.ts
└─ scripts/                # replay-fixtures.ts, sync-templates.ts, backfill-classify.ts
```

---

## 6. Environment variables

All variables are validated at boot by `packages/shared/src/env.ts` (Zod). Boot fails on a missing **required** variable. Columns: **W** = web, **K** = worker.

| Name                                      | Req | Used by       | Example / default                                            | Description                                                                                                                                                                                                                          |
| ----------------------------------------- | --- | ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_ENV`                                 | ✔   | W,K           | `local\|staging\|production`                                 | Environment                                                                                                                                                                                                                          |
| `APP_BASE_URL`                            | ✔   | W,K           | `https://desk.mmabon.ng`                                     | Public base URL                                                                                                                                                                                                                      |
| `DATABASE_URL`                            | ✔   | W,K           | `postgres://...:6543/postgres`                               | Pooled connection (pgbouncer, transaction mode) for web                                                                                                                                                                              |
| `DATABASE_URL_DIRECT`                     | ✔   | K             | `postgres://...:5432/postgres`                               | Direct connection for pg-boss (LISTEN/NOTIFY, advisory locks)                                                                                                                                                                        |
| `SUPABASE_URL`                            | ✔   | W,K           | `https://xyz.supabase.co`                                    |                                                                                                                                                                                                                                      |
| `SUPABASE_ANON_KEY`                       | ✔   | W (client)    |                                                              | Public anon key (safe in browser)                                                                                                                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`               | ✔   | W (server), K |                                                              | **Secret**                                                                                                                                                                                                                           |
| `STORAGE_BUCKET_MEDIA`                    | ✔   | W,K           | `wa-media`                                                   | Private bucket                                                                                                                                                                                                                       |
| `META_GRAPH_API_BASE_URL`                 | ✔   | K             | `https://graph.facebook.com` (mock: `http://localhost:4010`) |                                                                                                                                                                                                                                      |
| `META_GRAPH_API_VERSION`                  | ✔   | K             | `v25.0`                                                      | Pin; re-check yearly (Q-13)                                                                                                                                                                                                          |
| `META_APP_ID`                             | ✔   | W             |                                                              |                                                                                                                                                                                                                                      |
| `META_APP_SECRET`                         | ✔   | W             |                                                              | **Secret.** HMAC key for `X-Hub-Signature-256`                                                                                                                                                                                       |
| `META_WEBHOOK_VERIFY_TOKEN`               | ✔   | W             | random 32+ chars                                             | Our chosen token for the GET handshake                                                                                                                                                                                               |
| `META_SYSTEM_USER_TOKEN`                  | ✔   | K             |                                                              | **Secret.** Permanent system-user token with `whatsapp_business_messaging` and `whatsapp_business_management`                                                                                                                        |
| `META_WABA_ID`                            | ✔   | K             |                                                              |                                                                                                                                                                                                                                      |
| `META_PHONE_NUMBER_ID`                    | ✔   | W,K           |                                                              | Bootstrap Phone number ID for the first `wa_phone_number` seed row (pilot: `+2349079207221`). After seed, sends resolve the ID from the conversation’s number; Settings → WhatsApp sets `is_active` without a redeploy (§8.1.2, §23) |
| `WINDOW_SAFETY_MARGIN_SECONDS`            |     | K,W           | `300`                                                        | Treat the window as closed this many seconds early                                                                                                                                                                                   |
| `PAYSTACK_SECRET_KEY`                     | ✔   | W,K           | `sk_test_...`                                                | **Secret.** Also the HMAC-SHA512 key for webhooks                                                                                                                                                                                    |
| `PAYSTACK_PUBLIC_KEY`                     |     | W             | `pk_test_...`                                                | Not needed server-side; reserved                                                                                                                                                                                                     |
| `PAYSTACK_CALLBACK_URL`                   | ✔   | K             | `${APP_BASE_URL}/pay/thanks`                                 | Customer redirect after checkout                                                                                                                                                                                                     |
| `PAYSTACK_FALLBACK_EMAIL_DOMAIN`          | ✔   | K             | `pay.mmabon.ng`                                              | Synthetic customer email when none is known (Q-6)                                                                                                                                                                                    |
| `PAYSTACK_ENFORCE_IP_ALLOWLIST`           |     | W             | `true` in production                                         | Allow only 52.31.139.75, 52.49.173.169, 52.214.14.220                                                                                                                                                                                |
| `LLM_API_KEY`                             | ✔   | K             |                                                              | **Secret**                                                                                                                                                                                                                           |
| `LLM_BASE_URL`                            |     | K             | provider default                                             |                                                                                                                                                                                                                                      |
| `AI_CLASSIFIER_MODEL`                     | ✔   | K             | set from eval (Q-12)                                         | No in-code default                                                                                                                                                                                                                   |
| `AI_EXTRACTOR_MODEL`                      | P2  | K             |                                                              |                                                                                                                                                                                                                                      |
| `AI_SUGGEST_MODEL`                        | P2  | K             |                                                              |                                                                                                                                                                                                                                      |
| `AI_TRANSCRIBE_MODEL`                     | P2  | K             |                                                              |                                                                                                                                                                                                                                      |
| `AI_CLASSIFY_CONFIDENCE_REVIEW_THRESHOLD` |     | K             | `0.70`                                                       | Below this → `classification_needs_review=true`                                                                                                                                                                                      |
| `AI_CLASSIFY_MEDIA_LOOKAHEAD_SECONDS`     |     | K             | `60`                                                         | Delay for captionless media (§10.3)                                                                                                                                                                                                  |
| `SENTRY_DSN`                              |     | W,K           |                                                              |                                                                                                                                                                                                                                      |
| `LOG_LEVEL`                               |     | W,K           | `info`                                                       |                                                                                                                                                                                                                                      |
| `BUSINESS_TIMEZONE`                       |     | W,K           | `Africa/Lagos`                                               |                                                                                                                                                                                                                                      |

---

## 7. Data model (Postgres DDL)

The canonical source is `packages/db/migrations/0001_init.sql`. The Drizzle schema MUST mirror it exactly. All tables live in schema `public` (pg-boss uses schema `pgboss`). Every table has `created_at timestamptz not null default now()`; mutable tables also have `updated_at` maintained by the trigger `set_updated_at()`.

### 7.1 Enums

```sql
create type app_role            as enum ('admin','sales','designer','production','dispatch','manager');
create type msg_direction       as enum ('inbound','outbound');
create type msg_type            as enum ('text','image','audio','video','document','sticker','location',
                                         'contacts','interactive','button','reaction','template','unsupported');
create type msg_status          as enum ('received',                     -- inbound only
                                         'accepted','sent','delivered','read','failed'); -- outbound
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
```

### 7.2 Identity, contacts, conversations

```sql
create table staff_user (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        app_role not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table wa_phone_number (
  id                       uuid primary key default gen_random_uuid(),
  phone_number_id          text not null unique,     -- Meta Phone number ID
  display_phone_number     text not null,            -- e.g. +2349079207221
  waba_id                  text not null,
  label                    text not null,            -- 'test' | 'mmabon' | free-form admin label
  lifecycle                wa_phone_lifecycle not null default 'pending',
  is_active                boolean not null default false, -- default sender for new outbound with no conversation yet
  verified_name            text,                     -- approved display name from Meta
  name_status              text,                     -- APPROVED|PENDING|REJECTED|… from Meta
  code_verification_status text,                     -- VERIFIED|NOT_VERIFIED|… from Meta (never store the PIN)
  quality_rating           text,                     -- GREEN|YELLOW|RED|UNKNOWN (from webhooks/API)
  messaging_limit_tier     text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Exactly one active sending number at a time:
create unique index wa_phone_number_one_active on wa_phone_number (is_active) where is_active = true;

create table contact (
  id            uuid primary key default gen_random_uuid(),
  wa_id         text not null unique,               -- digits only
  e164          text not null,
  profile_name  text,                               -- from webhook contacts[].profile.name
  display_name  text,                               -- staff-edited
  email         text,                               -- optional, staff-entered
  notes         text,
  is_blocked    boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table conversation (
  id                    uuid primary key default gen_random_uuid(),
  contact_id            uuid not null references contact(id),
  wa_phone_number_id    uuid not null references wa_phone_number(id),
  status                conversation_status not null default 'open',
  snoozed_until         timestamptz,
  assigned_to           uuid references staff_user(id),
  last_inbound_at       timestamptz,                -- customer's latest message (wa timestamp)
  last_outbound_at      timestamptz,
  last_message_at       timestamptz,
  last_message_preview  text,                       -- ≤ 140 chars
  last_inbound_class    msg_class,
  unread_count          integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (contact_id, wa_phone_number_id)
);
create index conversation_last_message_idx on conversation (last_message_at desc);
-- window_expires_at is computed in code as last_inbound_at + interval '24 hours' (see §8.7)
```

### 7.3 Webhooks, messages, media, statuses

```sql
create table webhook_event (
  id               bigserial primary key,
  source           webhook_source not null,
  dedupe_key       text not null,                   -- sha256(raw body) hex
  signature_valid  boolean not null,
  headers          jsonb not null,                  -- allowlisted headers only (no auth headers)
  body             jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  process_error    text,
  unique (source, dedupe_key)
);

create table media_asset (
  id              uuid primary key default gen_random_uuid(),
  wa_media_id     text,                              -- inbound: from webhook; outbound: from /media upload
  mime_type       text,
  sha256_meta     text,                              -- value Meta reports
  file_size       bigint,
  storage_path    text,                              -- {yyyy}/{mm}/{conversation_id}/{media_asset_id}.{ext}
  status          media_status not null default 'pending',
  attempts        integer not null default 0,
  last_error      text,
  downloaded_at   timestamptz,
  wa_id_expires_at timestamptz,                      -- inbound: received_at + 7 days
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table message (
  id                     uuid primary key default gen_random_uuid(),
  conversation_id        uuid not null references conversation(id),
  wamid                  text unique,                -- null only for outbound before acceptance (never persisted that way; see §8.8)
  direction              msg_direction not null,
  type                   msg_type not null,
  text_body              text,                       -- text.body | button.text | interactive reply title
  caption                text,
  media_asset_id         uuid references media_asset(id),
  context_wamid          text,                       -- customer replied to this message
  reaction_emoji         text,
  location               jsonb,                      -- {latitude, longitude, name, address}
  wa_timestamp           timestamptz not null,       -- from Meta (unix seconds → timestamptz)
  received_at            timestamptz not null default now(),
  status                 msg_status not null,
  error_code             integer,
  error_title            text,
  error_detail           text,
  outbound_message_id    uuid,                       -- FK added below
  sent_by                uuid references staff_user(id),
  -- AI classification (inbound only; null for outbound)
  classification               msg_class,
  classification_confidence    numeric(4,3) check (classification_confidence between 0 and 1),
  classification_model         text,                 -- e.g. 'openai:<model-id>'
  classification_prompt_version text,                -- e.g. 'classify-v1.0.0'
  classification_ai_run_id     uuid,
  classified_at                timestamptz,
  classification_needs_review  boolean not null default false,
  classification_override      msg_class,            -- staff correction (eval label source)
  classification_override_by   uuid references staff_user(id),
  classification_override_at   timestamptz,
  -- P2 additive AI outputs (nullable; written by flagged steps)
  urgency                text check (urgency in ('low','normal','high')),
  urgency_ai_run_id      uuid,
  transcript             text,
  transcript_ai_run_id   uuid,
  media_description      text,
  media_description_ai_run_id uuid,
  raw                    jsonb not null,             -- the single message object from Meta / send response
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((direction = 'inbound' and status = 'received') or (direction = 'outbound' and status <> 'received')),
  check (direction = 'inbound' or classification is null)
);
create index message_conversation_ts_idx on message (conversation_id, wa_timestamp);
create index message_class_idx on message (classification) where direction = 'inbound';

create table message_status_event (
  id            bigserial primary key,
  wamid         text not null,
  status        text not null,                       -- sent|delivered|read|failed|played (store any)
  wa_timestamp  timestamptz not null,
  recipient_id  text,
  errors        jsonb,                               -- statuses[].errors
  pricing       jsonb,                               -- statuses[].pricing (billable, category, type, pricing_model)
  conversation  jsonb,                               -- statuses[].conversation (if present)
  raw           jsonb not null,
  created_at    timestamptz not null default now(),
  unique (wamid, status, wa_timestamp)
);

create table message_template (
  id              uuid primary key default gen_random_uuid(),
  wa_template_id  text unique,
  name            text not null,
  language        text not null,                     -- e.g. 'en'
  category        template_category not null,
  status          template_status not null,
  components      jsonb not null,                    -- as returned by Graph
  param_count     integer not null default 0,        -- body {{n}} count
  synced_at       timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (name, language)
);
```

### 7.4 Outbound, settings, AI runs, audit

```sql
create table automation_setting (
  key            text primary key,                   -- see §13.2
  enabled        boolean not null default false,
  allowed_origin outbound_origin not null,
  config         jsonb not null default '{}',
  description    text not null,
  updated_by     uuid references staff_user(id),
  updated_at     timestamptz not null default now()
);

create table feature_flag (
  key          text primary key,                     -- see §10.1
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
  template_params         jsonb,                     -- {"body":["Ada","MMB-Q-0142"]}
  origin                  outbound_origin not null,
  ai_run_id               uuid,
  order_id                uuid,                      -- FK added below
  status                  outbound_status not null default 'draft',
  created_by              uuid references staff_user(id),   -- null only for system_auto
  approved_by             uuid references staff_user(id),
  approved_at             timestamptz,
  rejected_by             uuid references staff_user(id),
  rejected_reason         text,
  auto_sent               boolean not null default false,
  automation_setting_key  text references automation_setting(key),
  idempotency_key         text not null unique,      -- client-generated UUID per compose action
  send_attempts           integer not null default 0,
  last_error_code         integer,
  last_error              text,
  needs_manual_check      boolean not null default false,
  wamid                   text unique,
  sent_at                 timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (kind <> 'text' or body_text is not null),
  check (kind <> 'media' or media_asset_id is not null),
  check (kind <> 'template' or template_id is not null),
  check (not auto_sent or automation_setting_key is not null)
);
alter table message add constraint message_outbound_fk
  foreign key (outbound_message_id) references outbound_message(id);

create table ai_run (
  id                 uuid primary key default gen_random_uuid(),
  step_key           text not null,                  -- 'classify' | 'extract_brief' | ...
  step_version       text not null,                  -- semver of step code
  provider           text not null,
  model              text not null,
  prompt_version     text not null,
  subject_type       text not null,                  -- 'message' | 'conversation' | 'order'
  subject_id         uuid not null,
  input_hash         text not null,                  -- sha256 of canonical input JSON
  input              jsonb not null,                 -- redact nothing (internal), retention §19
  output             jsonb,
  valid              boolean not null,
  validation_errors  jsonb not null default '[]',
  latency_ms         integer,
  tokens_in          integer, tokens_out integer,
  cost_usd_micros    bigint,
  created_at         timestamptz not null default now()
);
create index ai_run_subject_idx on ai_run (subject_type, subject_id);

create table audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor_kind   actor_kind not null,
  actor_id     uuid,
  action       text not null,                        -- dot.case e.g. 'outbound.approve'
  entity_type  text not null,
  entity_id    text not null,
  before       jsonb,
  after        jsonb,
  ip           inet,
  user_agent   text
);
create index audit_entity_idx on audit_log (entity_type, entity_id);

create table api_idempotency (
  key         text primary key,                     -- Idempotency-Key header (UUID)
  user_id     uuid not null references staff_user(id),
  status_code integer not null,
  response    jsonb not null,
  created_at  timestamptz not null default now()    -- purged after 24 h by maintenance.purge
);
```

**R-2 database backstop:**

```sql
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
```

### 7.5 Orders domain

```sql
create table orders (
  id                        uuid primary key default gen_random_uuid(),
  ref                       text not null unique,      -- 'MMB-2026-0001' (sequence per year)
  contact_id                uuid not null references contact(id),
  conversation_id           uuid not null references conversation(id),
  stage                     order_stage not null default 'new_enquiry',
  waiting_on                waiting_on not null default 'none',
  owner_id                  uuid references staff_user(id),
  event_date                date,
  need_by                   date,                      -- date goods must be with customer
  budget_kobo               bigint,
  risk_level                risk_level not null default 'unknown',
  risk_reasons              jsonb not null default '[]',
  lost_reason               text,
  last_customer_contact_at  timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table outbound_message add constraint outbound_order_fk foreign key (order_id) references orders(id);

create table default_rule (                            -- the ONLY source of 'assumed' values (R-1)
  id          uuid primary key default gen_random_uuid(),
  field_key   text not null,                           -- e.g. 'fit'
  value       jsonb not null,                          -- e.g. "standard"
  applies_to  jsonb not null default '{}',             -- e.g. {"product_code":"polo"}
  enabled     boolean not null default false,
  created_by  uuid references staff_user(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table order_field (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  key                   text not null,                 -- see §11.2 field catalogue
  value                 jsonb,                         -- null iff status='missing'
  status                field_status not null,
  evidence_message_ids  uuid[] not null default '{}',
  default_rule_id       uuid references default_rule(id),
  set_by                set_by not null,
  ai_run_id             uuid references ai_run(id),
  confirmed_by          uuid references staff_user(id),
  note                  text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (order_id, key),
  check ((status = 'missing') = (value is null)),
  check (status <> 'assumed' or default_rule_id is not null),
  check (status in ('missing','assumed') or set_by = 'staff' or cardinality(evidence_message_ids) >= 1)
);

create table order_line_item (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_code  text,                                  -- from product catalogue (price_rule.product_code)
  product_label text not null,                         -- as customer said, e.g. 'polos'
  attributes    jsonb not null default '{}',           -- {fabric:{value,status,evidence[]}, decoration:{...}, placement:{...}}
  removed_at    timestamptz,                           -- soft delete (scenario E)
  sort          integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table order_variant (
  id            uuid primary key default gen_random_uuid(),
  line_item_id  uuid not null references order_line_item(id) on delete cascade,
  colour        text,
  cut           text,                                  -- 'men_round_neck' | 'ladies_v_neck' | free text
  qty           integer check (qty is null or qty > 0),
  status        field_status not null,
  evidence_message_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table order_size_qty (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references order_variant(id) on delete cascade,
  size        text not null,                           -- 'S','M','L','XL','2XL','3XL' or custom
  qty         integer check (qty is null or qty >= 0),
  status      field_status not null,
  evidence_message_ids uuid[] not null default '{}'
);

create table personalisation_entry (
  id           uuid primary key default gen_random_uuid(),
  variant_id   uuid references order_variant(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  person_label text,
  back_text    text,                                   -- nickname
  size         text,
  status       field_status not null,
  evidence_message_ids uuid[] not null default '{}'
);

create table clarification_question (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  field_key          text not null,
  question_text      text not null,
  priority           integer not null,                 -- 1 = ask first
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
  target              text,                            -- e.g. 'line_items[polo].variants[red].colour'
  before              jsonb,
  after               jsonb,
  reason              text,
  needs_customer_ack  boolean not null default false,
  customer_ack_message_id uuid references message(id),
  notify_roles        app_role[] not null default '{}',
  acknowledged        jsonb not null default '{}'      -- {"design":{"by":uuid,"at":ts}}
);
create index change_event_order_idx on change_event (order_id, at);

create table quote (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  ref            text not null,                        -- 'MMB-Q-0142'
  version        integer not null,
  status         quote_status not null default 'draft',
  items          jsonb not null,                       -- [{line_item_id,label,qty,unit_kobo,total_kobo,rule_ids[]}]
  subtotal_kobo  bigint not null,
  delivery_kobo  bigint not null default 0,
  discount_kobo  bigint not null default 0,
  total_kobo     bigint not null,
  valid_until    date,
  sent_outbound_id uuid references outbound_message(id),
  created_by     uuid references staff_user(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (order_id, version),
  unique (ref, version),
  check (total_kobo = subtotal_kobo + delivery_kobo - discount_kobo)
);

create table price_rule (
  id            uuid primary key default gen_random_uuid(),
  product_code  text not null,                         -- 'polo','tshirt_round','tshirt_v','cap'
  decoration    text,                                  -- 'screen','dtf','embroidery', null = any
  min_qty       integer not null,
  max_qty       integer,                               -- null = no upper bound
  unit_kobo     bigint not null,
  addons        jsonb not null default '{}',           -- {"back_name_kobo":150000,"rush_pct":20}
  valid_from    date not null,
  valid_to      date,
  enabled       boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table lead_time_rule (
  id              uuid primary key default gen_random_uuid(),
  product_code    text not null,
  process         text not null,                       -- 'sewing','screen','dtf','embroidery','personalisation'
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
  paystack_reference  text not null unique,            -- 'MMB-Q-0142-v2-DEP-1'
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
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
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
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index followup_due_idx on followup (status, due_at);
```

### 7.6 Seed data (migration `0002_seed.sql`)

- `feature_flag`:

  | Key                   | `enabled`                  |
  | --------------------- | -------------------------- |
  | `ai.classify`         | **true**                   |
  | `ai.suggest_reply`    | false                      |
  | `ai.urgency`          | false                      |
  | `ai.extract_brief`    | false                      |
  | `ai.transcribe_audio` | false                      |
  | `ai.describe_image`   | false                      |
  | `orders.module`       | false                      |
  | `payments.paystack`   | false                      |
  | `followups.generator` | false                      |
  | `feasibility.engine`  | false                      |
  | `sends.paused`        | false (kill switch, §19.5) |

- `automation_setting` (all `enabled=false`):

  | Key                              | `allowed_origin` |
  | -------------------------------- | ---------------- |
  | `auto_send.read_receipts`        | `system_auto`    |
  | `auto_send.payment_received_ack` | `system_auto`    |
  | `auto_send.out_of_hours_ack`     | `system_auto`    |
  | `auto_send.followup_reminders`   | `followup`       |

- `wa_phone_number`: one bootstrap row from env — `phone_number_id = META_PHONE_NUMBER_ID`, `display_phone_number = '+2349079207221'`, `waba_id = META_WABA_ID`, `label = 'test'`, `lifecycle = 'connected'`, `is_active = true`. Additional numbers (MMABON) are upserted via Settings → WhatsApp → Refresh from Meta (§16.10, §23); never store the two-step PIN.
- No `default_rule`, `price_rule` or `lead_time_rule` rows: MMABON supplies them (Q-3, Q-4).

### 7.7 Row Level Security

- Enable RLS on every public table.
- The browser client uses the anon key + user JWT, **only** to subscribe to Realtime Broadcast and for auth. All data reads and writes go through `/api/*` route handlers. Those handlers use the service role **after** checking the session and role with `requireRole()` (`packages/domain/permissions.ts`).
- Default policy: `deny all` for `anon` and `authenticated` on all tables, except `staff_user` `select` where `id = auth.uid()`.

**Test:** `rls-deny-direct-select`: an authenticated anon-key client selecting from `message` returns 0 rows or an error.

---

## 8. WhatsApp Cloud API integration

The wire formats below match Meta's Cloud API as documented through Oct 2026, cross-checked against secondary references listed in §24. Meta's own docs block automated fetching, so implementers MUST open the official pages in a browser during week 1 and log any difference as a `Q-n`.

### 8.1 Meta configuration (in-spec runbook; do this once, then add numbers)

Official Meta developer pages block automated fetching. Cross-check the steps below in a browser against the URLs in §24 during week 1 and log any difference as a `Q-n` (see Q-13). Facts below were checked 17 Oct 2026 against Meta’s public WhatsApp Business FAQ, Meta-documented console flows in partner writeups, and Meta’s published limits.

**Design decision:** one Business portfolio, one Meta app, one WhatsApp Business Account (WABA). Both the pilot test number and the later MMABON number live on that same WABA. Swapping numbers does **not** require a new app, token, webhook, or code change (see §8.1.2 and §23).

**Do not use:**

- Meta’s built-in test sender (5 recipients only). Always register a real number.
- WhatsApp Business app **coexistence**. That mode is one number per WABA and would block adding the MMABON number beside the test number. This product uses Cloud API–only registration.

**What stays the same when the number changes:** portfolio, Meta app (App ID / App Secret), WABA ID, system-user token, webhook URL + verify token + field subscriptions, message templates (they belong to the WABA).

**What changes per number:** Phone number ID, display number, display name, two-step PIN, quality rating, messaging limit, and the 1,000 free service messages per month (per number). Conversations stay keyed by `conversation.wa_phone_number_id`.

**Business verification** is **not** required to start. An unverified portfolio allows **2** registered phone numbers (exactly: test, then MMABON) and a business-initiated messaging limit of **250** unique customers per rolling 24 h outside the service window. Verification later raises those ceilings; it does not unlock the Cloud API itself.

#### 8.1.1 Ordered setup (Kehinde as admin; portfolio named for MMABON)

1. **Facebook account with 2FA.** No password sharing. Developers are added as people on the portfolio with least privilege.
2. **Business portfolio** at [business.facebook.com](https://business.facebook.com): create or confirm it; name it for MMABON; Kehinde is the admin.
3. **Meta app** at [developers.facebook.com](https://developers.facebook.com): Create app → use case **Connect with customers through WhatsApp** → attach the MMABON portfolio. Copy **App ID** and **App Secret** into env only (`META_APP_ID`, `META_APP_SECRET`). Never commit them.
4. **Free the test SIM before adding it.** Pilot number: **`+2349079207221`**. A number already on personal WhatsApp **cannot** be registered until that WhatsApp account is deleted (phone: Settings → Account → Delete account). Wait until Meta accepts the number, then add it. Consumer-app chat history on that SIM is lost. Coexistence does **not** apply to the personal WhatsApp app.
5. **Add the phone number:** App Dashboard → WhatsApp → API Setup → **Add phone number**. Enter business profile details and `+2349079207221`. Verify by SMS or voice (Nigeria SIMs: try voice if SMS does not arrive). Display name is reviewed **per number**; until approval, customers may see the digits.
6. **Register for Cloud API** (required; the console “add number” flow alone is not enough). Use the temporary access token from API Setup for this call if the permanent system-user token (step 9) does not exist yet:

   ```http
   POST /{META_GRAPH_API_VERSION}/{phone-number-id}/register
   Authorization: Bearer {temporary_or_system_user_token}
   Content-Type: application/json

   { "messaging_product": "whatsapp", "pin": "<6-digit PIN>" }
   ```

   The PIN is chosen and kept by Kehinde (later: MMABON’s owner for the production number). It sets two-step verification. **MUST NOT** be written to git, the database, logs, `audit_log`, chat, or this document.

7. **Confirm registration:** `GET /{META_GRAPH_API_VERSION}/{phone-number-id}` with the bearer token MUST show `status=CONNECTED` and `platform_type=CLOUD_API`. Record **Phone number ID** and **WABA ID**. These are different from App ID and portfolio ID. Seed `wa_phone_number` from them (§7.2, §7.6).
8. **Payment method on the WhatsApp account** (WhatsApp Manager → Settings → Payment methods). A card only on the portfolio is **not** enough; template sends fail without a WABA payment method (error **141006**). Kehinde’s card is fine for the pilot; MMABON replaces it in Billing at cutover (§23).
9. **System user + permanent token** (required before staging/production sends): Business settings → System users → Add (role Admin) → Assign assets: the Meta app (manage / full control) and the WABA (full control) → Generate token → expiry **Never** → permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Copy once into `META_SYSTEM_USER_TOKEN` on the host. The temporary token on the API Setup page expires in ~24 h — do not leave it as the only credential.
10. **One WABA webhook** (not a per-number override): callback `${APP_BASE_URL}/api/webhooks/whatsapp`, verify token = `META_WEBHOOK_VERIFY_TOKEN`. Subscribe fields: **`messages`** (inbound + statuses), **`message_template_status_update`**, **`phone_number_quality_update`**, **`phone_number_name_update`**, **`account_update`**, **`account_review_update`**, **`business_capability_update`**. Re-confirm field names in Meta’s console (Q-13).
11. **App mode Live.** In Development, inbound from ordinary customers does not arrive. This app serves one owned WABA; this is **not** a tech-provider App Review. Publish / switch the app to Live in the App Dashboard sidebar.
12. **Launch templates:** create the four templates in §8.11 in WhatsApp Manager on this WABA; wait for approval. Templates stay valid when a second number is added.

**Checklist before the first live message:** number `CONNECTED` on Cloud API; permanent token in env; webhook GET handshake and a real inbound POST both succeed; payment method present; app Live; at least one `UTILITY` template `APPROVED` if testing outside-window sends.

#### 8.1.2 Number identity in the app (send from the number that received)

Outbound MUST use the **Phone number ID of the conversation’s** `wa_phone_number` row, not a hard-coded global ID at send time. A customer who wrote to `+2349079207221` is always answered from that number. The MMABON number never “takes over” an old thread.

- `META_PHONE_NUMBER_ID` is the **bootstrap** id for the first seed row only (§7.6). After seed, Settings → WhatsApp (§16.10) is the switch for which number is `is_active` (default for new outbound that has no conversation yet).
- Media download and fixture replay resolve `phone_number_id` from the conversation (or message’s number); fall back to env only when no row exists yet.
- Adding or activating a number does **not** require a deploy: upsert rows from Meta, set `is_active`, write `audit_log`.

### 8.2 `GET /api/webhooks/whatsapp`: verification handshake

1. Read the query params `hub.mode`, `hub.verify_token`, `hub.challenge`.
2. If `hub.mode === 'subscribe'` and `timingSafeEqual(hub.verify_token, META_WEBHOOK_VERIFY_TOKEN)` → respond `200`, `Content-Type: text/plain`, body = the raw `hub.challenge` string (not JSON).
3. Otherwise → `403`.

**AC-WH-1:** GET with the correct token and `hub.challenge=1158201444` returns body `1158201444`, status 200. A wrong token returns 403. Missing params return 403.

### 8.3 `POST /api/webhooks/whatsapp`: ingest

Algorithm (Node.js runtime; `export const runtime = 'nodejs'`; `export const dynamic = 'force-dynamic'`):

1. `raw = Buffer.from(await req.arrayBuffer())`. **Never** parse the JSON before verifying.
2. `sig = req.headers.get('x-hub-signature-256')`. If it's missing or doesn't start with `sha256=` → go to step 4 with `valid=false`.
3. `expected = 'sha256=' + hmacSHA256(META_APP_SECRET, raw).hex`. Compare `valid = timingSafeEqual(sig, expected)`, guarding for equal length.
4. If `!valid`: increment metric `webhook_invalid_signature_total`, insert `webhook_event` with `signature_valid=false` (body stored for forensics; rate-limit to 100/h), return **401**. Do not enqueue.
5. `body = JSON.parse(raw)`. If `body.object !== 'whatsapp_business_account'` → store with `process_error='UNEXPECTED_OBJECT'`, return 200.
6. In one transaction:
   ```sql
   insert into webhook_event (source, dedupe_key, signature_valid, headers, body)
   values ('meta', sha256hex(raw), true, $headers, $body)
   on conflict (source, dedupe_key) do nothing returning id;
   ```

   - If a row was returned → `boss.send('wa.process_event', {webhookEventId: id}, {singletonKey: 'wa-evt-'+id, retryLimit: 10, retryBackoff: true}, {db: tx})`.
   - If no row → this is an exact duplicate, so don't enqueue.
7. Return **200** with an empty body.

**Requirements:**

- **Performance:** p95 handler time ≤ 300 ms; never > 5 s. No Graph, LLM or Storage calls in this handler.
- **Duplicates:** Meta delivers at least once and retries non-200 responses with backoff for up to ~7 days. Ordering is not guaranteed. Payloads can be up to ~3 MB, so set the route body limit to 5 MB.

**AC-WH-2:** a valid signed fixture → exactly 1 `webhook_event` and 1 job, response 200 in < 300 ms (local).
**AC-WH-3:** a tampered body (1 byte changed) → 401, no job.
**AC-WH-4:** the same payload POSTed 3× → 1 `webhook_event`, 1 job.
**AC-WH-5:** a k6 load test of 50 req/s for 5 min → 0 non-2xx, p95 ≤ 300 ms (staging).

### 8.4 Webhook payload parsing (Zod schemas in `packages/whatsapp/src/webhook.ts`)

Top level: `{ object: 'whatsapp_business_account', entry: [{ id: <WABA_ID>, changes: [{ field, value }] }] }`

For `field === 'messages'`, `value` contains:

- `messaging_product: 'whatsapp'`
- `metadata: { display_phone_number, phone_number_id }`
- `contacts?: [{ profile: { name }, wa_id }]`
- `messages?: InboundMessage[]`
- `statuses?: Status[]`
- `errors?: Error[]`

`InboundMessage` common fields: `from` (wa_id), `id` (wamid), `timestamp` (unix seconds as a string), `type`, optional `context: { from, id }`. Type-specific objects:

| `type`                  | Object                                                                                           | Map to `message`                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `text`                  | `text: { body }`                                                                                 | `text_body = body`                                                 |
| `image`                 | `image: { id, mime_type, sha256, caption?, url? }`                                               | media + `caption`                                                  |
| `audio`                 | `audio: { id, mime_type, sha256?, voice?: boolean, url? }`                                       | media (`voice` kept in `raw`)                                      |
| `video`                 | `video: { id, mime_type, sha256, caption?, url? }`                                               | media + caption                                                    |
| `document`              | `document: { id, mime_type, sha256, filename?, caption?, url? }`                                 | media + caption                                                    |
| `sticker`               | `sticker: { id, mime_type, sha256, animated? }`                                                  | media                                                              |
| `location`              | `location: { latitude, longitude, name?, address? }`                                             | `location` jsonb                                                   |
| `contacts`              | `contacts: [...]`                                                                                | `raw` only; `text_body = '[contact card]'`                         |
| `interactive`           | `interactive: { type: 'button_reply'\|'list_reply', button_reply?\|list_reply?: { id, title } }` | `text_body = title`                                                |
| `button`                | `button: { text, payload }` (quick-reply on template)                                            | `text_body = text`                                                 |
| `reaction`              | `reaction: { message_id, emoji }`                                                                | `reaction_emoji`, `context_wamid = message_id`. **Not classified** |
| `unsupported` / unknown | `errors`                                                                                         | `type='unsupported'`, `text_body = null`. **Not classified**       |

`Status` fields: `id` (wamid of OUR message), `status` (`sent|delivered|read|failed`; other values are stored but don't change `message.status`), `timestamp`, `recipient_id`, `conversation?`, `pricing?` (`billable`, `pricing_model`, `category`, `type`), `errors?: [{ code, title, message, error_data: { details } }]`.

Unknown fields MUST be tolerated (`.passthrough()`). The whole message object is stored in `message.raw`.

**AC-WH-6:** contract tests in `tests/contract/meta-*.test.ts` parse every file in `fixtures/meta-payloads/` (at least: text, image+caption, audio voice, document, location, interactive button_reply, reaction, unsupported, statuses sent/delivered/read/failed with errors, template status update) without throwing, and map each to the expected rows.

### 8.5 `wa.process_event` handler

For each `entry[].changes[]`:

- **`messages` with `value.messages[]`.** For each message, in one transaction:
  1. Upsert `contact` on `wa_id` (set `profile_name` from the matching `value.contacts[]`; `e164 = '+' + wa_id`).
  2. Resolve `wa_phone_number` by `phone_number_id = metadata.phone_number_id`. If missing, upsert a row (`lifecycle='connected'`, `is_active=false`, `label` defaulting to the display number, `display_phone_number` from `metadata.display_phone_number`, `waba_id` from `entry.id`) so a newly registered Meta number is not dropped before an admin refreshes Settings. Then upsert `conversation` on (`contact_id`, `wa_phone_number_id`). If the status is `closed` → set it to `open`.
  3. If `type` has media: insert `media_asset(wa_media_id, mime_type, sha256_meta, status='pending', wa_id_expires_at = now()+7 days)`.
  4. `insert into message (...) values (..., direction='inbound', status='received', wa_timestamp=to_timestamp(timestamp)) on conflict (wamid) do nothing returning id`.
  5. If inserted:
     - update `conversation`: `last_inbound_at = greatest(last_inbound_at, wa_timestamp)`, `last_message_at`, `last_message_preview`, `unread_count = unread_count + 1`
     - update any open `orders` for this conversation: `last_customer_contact_at`
     - enqueue `wa.download_media` (if media)
     - enqueue `ai.classify_message` (if the type is classifiable and `FF:ai.classify` is on; captionless media gets `startAfter = AI_CLASSIFY_MEDIA_LOOKAHEAD_SECONDS`)
     - enqueue other enabled `on_ingest` pipeline steps (§10.1)
  6. After commit: broadcast `message.created` + `conversation.updated`.
- **`messages` with `value.statuses[]`:** handled per §8.6.
- **`message_template_status_update`:** update `message_template.status` by `message_template_id`/name+language, broadcast `system.alert` if the new status is `REJECTED|PAUSED|DISABLED`.
- **`phone_number_quality_update`, `phone_number_name_update`, `account_update`, `account_review_update`, `business_capability_update`:** update `wa_phone_number` fields (`quality_rating`, `messaging_limit_tier`, `name_status`, `verified_name`, `code_verification_status`, `lifecycle` as applicable); insert `audit_log(actor_kind='system', action='meta.'+field)`; broadcast `system.alert`.
- Finally: set `webhook_event.processed_at = now()`. On exception: set `process_error`, rethrow (pg-boss retries; after 10 failures the job goes to dead-letter queue `wa.process_event.dlq`, and an alert fires).

**AC-WH-7:** replaying `fixtures/conversations/A_scattered.yaml` creates 1 contact, 1 conversation and 5 inbound messages, in `wa_timestamp` order in the thread view, each visible on the dashboard ≤ 5 s after POST (staging, p95).

### 8.6 Message status handling

Ranks: `accepted=0`, `sent=1`, `delivered=2`, `read=3`. `failed` is special.

1. Insert `message_status_event` `on conflict (wamid, status, wa_timestamp) do nothing`.
2. Find `message` by `wamid`. If it isn't found (race: the status arrived before the send response was saved) → retry the job with a 10 s delay, up to 6 times, then store the event only.
3. Apply:
   - `sent|delivered|read`: update `message.status` only if `rank(new) > rank(current)` and `current <> 'failed'`.
   - `failed`: set `status='failed'`, `error_code/title/detail` from `errors[0]`, **unless** the current status is `delivered` or `read` (keep it, store the event only).
   - Mirror the latest status onto `outbound_message.status` (`sent` → `sent`; `failed` → `failed` with `last_error_code`).
4. Broadcast `message.status`.

**AC-WH-8:** statuses delivered in the order read → sent → delivered end at `read`. A failed status after read is stored but `message.status` stays `read`. Duplicates make no change.

### 8.7 The 24-hour customer service window

- `windowExpiresAt(conversation) = last_inbound_at + 24h` (null if there has never been an inbound message).
- `isWindowOpen(conv, now) = last_inbound_at != null && now < last_inbound_at + 24h − WINDOW_SAFETY_MARGIN_SECONDS`.
- **Free-form** (`kind = text | media`) outbound is allowed only if `isWindowOpen` at enqueue time **and** at send time (re-checked in the worker).
- **Template** outbound is allowed at any time, provided the template `status='APPROVED'` and the `template_params` count equals `param_count`.
- If Meta returns error **131047** (re-engagement required / outside window): mark the outbound `failed`, set `last_error_code=131047`, and show the UI message _"The 24-hour window has closed. Choose an approved template."_
- UI: the thread header shows a countdown chip (`Window open · 3h 12m left`, amber under 2 h, red/closed otherwise). See §15.3.
- Pricing note (for the dashboard cost card): since 1 Oct 2026, Meta charges per delivered _service_ message after the first 1,000 per number per month, and charges every template message. Store `statuses[].pricing` and show monthly counts by `pricing.category`. Do not hard-code rates.

**AC-WIN-1:** the composer is disabled for free text when the window is closed, and the template picker is offered.
**AC-WIN-2:** a worker re-check: an outbound queued at 23h58m with a 300 s margin → not sent, `failed` with code `WINDOW_CLOSED` (our code), and no Graph call.
**AC-WIN-3:** a mock Graph returning 131047 → status failed, UI message shown.

### 8.8 Sending (`packages/whatsapp/src/send.ts`)

Resolve `phoneNumberId` from the conversation’s `wa_phone_number.phone_number_id` (the number that received the inbound). If there is no conversation yet (rare system path), use the row with `is_active = true`, else fall back to `META_PHONE_NUMBER_ID`. Endpoint: `POST {META_GRAPH_API_BASE_URL}/{META_GRAPH_API_VERSION}/{phoneNumberId}/messages`, header `Authorization: Bearer {META_SYSTEM_USER_TOKEN}`, `Content-Type: application/json`.

Request bodies:

```jsonc
// text
{ "messaging_product": "whatsapp", "recipient_type": "individual", "to": "<wa_id>",
  "type": "text", "text": { "preview_url": true, "body": "<body_text>" } }
// image (also: document | video | audio with matching key; audio has no caption)
{ "messaging_product": "whatsapp", "recipient_type": "individual", "to": "<wa_id>",
  "type": "image", "image": { "id": "<uploaded media id>", "caption": "<media_caption>" } }
// template
{ "messaging_product": "whatsapp", "to": "<wa_id>", "type": "template",
  "template": { "name": "<name>", "language": { "code": "<language>" },
    "components": [ { "type": "body", "parameters": [ { "type": "text", "text": "<p1>" } ] } ] } }
// optional reply-to (any type): add  "context": { "message_id": "<wamid>" }
```

Success response: `{ "messaging_product":"whatsapp", "contacts":[{"input","wa_id"}], "messages":[{"id":"wamid..."}] }`.

**Outbound media upload:** `POST /{phone-number-id}/media`, multipart with fields `messaging_product=whatsapp`, `type=<mime>`, `file=@...`. The response `{id}` is stored in `media_asset.wa_media_id`. The staff file is first uploaded to Storage via `POST /api/media/upload`.

**`wa.send_outbound` job** (`singletonKey = 'send-'+outboundId`, `retryLimit: 5`, `retryDelay: 15`, `retryBackoff: true`):

1. Take the advisory lock `pg_advisory_xact_lock(hashtext('conv-send-'||conversation_id))`. This serialises sends per customer and respects the pair rate limit.
2. Load the outbound. If the status isn't `approved` → no-op (already sent or cancelled).
3. Run the **R-2 check** (§2). Run the window check for free-form.
4. `update outbound_message set status='sending', send_attempts=send_attempts+1 where id=$1 and status='approved'`. If 0 rows → no-op. The guard trigger enforces R-2 again.
5. Call Graph (timeout 15 s).
6. **On 2xx:** in one transaction:
   - set the outbound to `sent`, with `wamid` and `sent_at`
   - insert `message` (`direction='outbound'`, `status='accepted'`, `wamid`, `wa_timestamp=now()`, `sent_by=approved_by`, `outbound_message_id`, `raw`=request+response)
   - update the conversation's `last_outbound_at` and preview
   - then broadcast
7. **On error:** classify via §8.9.
   - _Retryable_ → set the status back to `approved`, rethrow (pg-boss retries).
   - _Terminal_ → `failed` + error fields, broadcast.
   - _Ambiguous_ (timeout or connection reset **after** the request was written) → `failed`, `needs_manual_check=true`, **no automatic retry**. Meta has no idempotency key, and a blind retry could double-send. The UI shows "Delivery uncertain – check before resending."

### 8.9 Error handling map (Graph)

| Condition                                                                                                                      | Class                       | Action                                             |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------- |
| HTTP 5xx, ECONNREFUSED before send, 429, code `130429` (throughput), `131056` (pair rate limit), `131000` (generic, transient) | Retryable                   | Backoff 15 s × 2^n (max 5)                         |
| `131047` (re-engagement / window)                                                                                              | Terminal                    | Window-closed UX                                   |
| `131026` (undeliverable: not on WhatsApp / blocked)                                                                            | Terminal                    | Flag the contact `notes`; UI message               |
| `132000`–`132069` (template param / format / not found / paused)                                                               | Terminal                    | Show the template error; trigger `templates.sync`  |
| `100` (invalid parameter), `131008`/`131009` (missing/invalid param)                                                           | Terminal                    | Log with payload; developer alert                  |
| `190` (token expired/invalid), `10`/`200` (permission)                                                                         | Terminal + **system alert** | Pause the `wa.send_outbound` queue; page the admin |
| `131031` (account locked/restricted)                                                                                           | Terminal + **system alert** | Pause sends                                        |
| Timeout after write                                                                                                            | Ambiguous                   | `needs_manual_check`                               |

Every Graph error stores `code`, `error_subcode`, `message` and `fbtrace_id` in `outbound_message.last_error` (JSON string).

### 8.10 Media download (`wa.download_media`)

Job: `singletonKey='media-'+mediaAssetId`, `retryLimit: 8`, `retryDelay: 30`, `retryBackoff: true`, `expireInSeconds: 600`.

1. If `now() > wa_id_expires_at` → `status='expired'`, stop.
2. Resolve `phoneNumberId` from the media’s conversation → `wa_phone_number.phone_number_id` (else the active row, else `META_PHONE_NUMBER_ID`). `GET /{version}/{wa_media_id}?phone_number_id={phoneNumberId}` with the bearer token. Response: `{ url, mime_type, sha256, file_size, id, messaging_product }`. If the webhook already included `url`, use it for the first attempt only.
3. `GET url` with the `Authorization: Bearer` header **immediately**. The URL is valid for 5 minutes only. Stream it into a buffer, max 100 MB.
4. On 404 → re-request a fresh URL (step 2) once within the same attempt. If that fails too → throw (retry).
5. Compute sha256 of the bytes. If `sha256_meta` is present and the values differ → throw `SHA_MISMATCH` (retry).
6. Upload to Storage bucket `STORAGE_BUCKET_MEDIA` at `{yyyy}/{mm}/{conversation_id}/{media_asset_id}.{ext}` (ext from the mime map) with `upsert: true`.
7. Update `media_asset`: `status='stored'`, `storage_path`, `file_size`, `downloaded_at`. Broadcast `media.stored`.
8. If the `FF:ai.transcribe_audio` / `FF:ai.describe_image` flags are on → enqueue those steps.

**Serving:** `GET /api/media/:id` checks the session, then responds `302` to a Storage signed URL valid for 300 s. Media is **never** public.

**AC-MED-1:** an image fixture → stored within 10 s; the thread shows a thumbnail. **AC-MED-2:** a mock returning 404 on the first URL then succeeding → stored. **AC-MED-3:** a hash mismatch → retried, then `failed` after 8 attempts, and the UI shows "Media unavailable".

### 8.11 Templates

- `templates.sync` cron runs hourly (and on demand from the Settings → Templates screen): `GET /{version}/{META_WABA_ID}/message_templates?limit=100` (follow `paging.next`), then upsert `message_template` (compute `param_count` from the body component's `{{n}}` placeholders).
- Templates are created and edited in Meta's WhatsApp Manager by MMABON, not in our app (P1).
- Required launch templates (MMABON to create; wording to be approved at the first meeting, Q-5), all category `UTILITY`, language `en`:

| Name               | Body                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `followup_general` | `Hello {{1}}, this is MMABON following up on your enquiry. Please reply here when you're ready and we'll continue.` |
| `quote_ready`      | `Hello {{1}}, your quote {{2}} is ready. Total: {{3}}. Reply here to discuss or confirm.`                           |
| `payment_link`     | `Hello {{1}}, here is your secure Paystack payment link for {{2}}: {{3}}`                                           |
| `order_update`     | `Hello {{1}}, update on order {{2}}: {{3}}`                                                                         |

### 8.12 Rate limits we respect

- **Throughput:** 80 msgs/s per number (default). Irrelevant at MMABON volume, but handle 130429 as retryable.
- **Pair limit:** about 1 message per 6 s to the same user. The per-conversation advisory lock plus 131056 backoff handle this.
- **Business-initiated messaging limits** (unique users per 24 h outside the window) start at 250 per portfolio. The app does not do broadcasts.
- **Graph management calls:** ~5,000/h per WABA (template sync is hourly → fine).

---

## 9. Job catalogue (pg-boss)

Queue names are constants in `packages/queue/src/jobs.ts`. All handlers are idempotent.

| Queue                    | Payload                                     | Trigger                                                           | Retry           | Singleton key                          | Phase |
| ------------------------ | ------------------------------------------- | ----------------------------------------------------------------- | --------------- | -------------------------------------- | ----- |
| `wa.process_event`       | `{webhookEventId:number}`                   | webhook ingest                                                    | 10, backoff     | `wa-evt-{id}`                          | P1    |
| `wa.download_media`      | `{mediaAssetId}`                            | process_event                                                     | 8, 30 s backoff | `media-{id}`                           | P1    |
| `wa.send_outbound`       | `{outboundId}`                              | approve / send                                                    | 5, 15 s backoff | `send-{id}`                            | P1    |
| `ai.classify_message`    | `{messageId}`                               | process_event                                                     | 3, 20 s backoff | `cls-{messageId}-{promptVersion}`      | P1    |
| `templates.sync`         | `{}`                                        | cron `0 * * * *` + manual                                         | 3               | `tpl-sync`                             | P1    |
| `paystack.process_event` | `{webhookEventId}`                          | paystack ingest                                                   | 10, backoff     | `ps-evt-{id}`                          | P1b   |
| `orders.recompute_risk`  | `{orderId}`                                 | order change, nightly cron `0 1 * * *` (Africa/Lagos = 00:00 UTC) | 3               | `risk-{orderId}`                       | P2    |
| `ai.extract_brief`       | `{conversationId, orderId?, uptoMessageId}` | manual "Extract brief" + on_ingest if flag                        | 2               | `ext-{conversationId}-{uptoMessageId}` | P2    |
| `ai.suggest_reply`       | `{conversationId, uptoMessageId}`           | manual "Suggest reply" + on_ingest if flag                        | 2               | `sug-{conversationId}-{uptoMessageId}` | P2    |
| `ai.urgency`             | `{messageId}`                               | on_ingest if flag                                                 | 2               | `urg-{messageId}`                      | P2    |
| `ai.transcribe_audio`    | `{messageId}`                               | media stored + flag                                               | 3               | `trn-{messageId}`                      | P2    |
| `ai.describe_image`      | `{messageId}`                               | media stored + flag                                               | 3               | `img-{messageId}`                      | P2    |
| `followups.generate_due` | `{}`                                        | cron `*/15 * * * *` if flag                                       | 1               | `fu-gen`                               | P2    |
| `maintenance.purge`      | `{}`                                        | cron `0 2 * * *`                                                  | 1               | `purge`                                | P1    |

Dead-letter: every queue `X` has `X.dlq`. A worker on each DLQ inserts `audit_log(action='job.dead_letter')` and broadcasts `system.alert`.

---

## 10. AI layer: pluggable pipeline

### 10.1 Pipeline framework (`packages/ai/src/pipeline.ts`)

```ts
export type Trigger =
  | "on_ingest"
  | "on_media_stored"
  | "manual"
  | "on_order_change";
export interface PipelineStep<I, O> {
  key: string; // 'classify'
  version: string; // semver, bump on logic change
  promptVersion: string; // 'classify-v1.0.0'
  featureFlag: string; // 'ai.classify'
  triggers: Trigger[];
  appliesTo(ctx: StepContext): boolean; // e.g. inbound + classifiable type
  buildInput(ctx: StepContext): Promise<I>; // deterministic, size-capped
  run(input: I, llm: LlmClient): Promise<unknown>; // raw model output
  outputSchema: z.ZodType<O>;
  validate(output: O, input: I, ctx: StepContext): ValidationResult<O>; // grounding etc. (R-1)
  persist(output: O, ctx: StepContext, aiRunId: string, tx: Tx): Promise<void>;
}
```

- **Registry:** `steps = [classify, urgency, transcribeAudio, describeImage, extractBrief, suggestReply]`.
- The executor (`runStep`):
  1. checks the flag
  2. builds the input and computes `input_hash`
  3. calls the LLM with a JSON schema (from `z.toJSONSchema(outputSchema)`) using `strict: true`
  4. parses with Zod
  5. validates
  6. writes `ai_run` (always, even when invalid)
  7. persists only if valid
  8. broadcasts
- On model/transport error: throw (job retry). On schema/validation failure after 1 automatic re-ask: persist nothing and set `ai_run.valid=false`.
- **Adding a new step** = one file in `packages/ai/src/steps/`, one flag row, one queue name, one eval folder. No changes to ingest.

| Flag                  | Step                                                                           | Phase | Default |
| --------------------- | ------------------------------------------------------------------------------ | ----- | ------- |
| `ai.classify`         | classify                                                                       | P1    | **on**  |
| `ai.urgency`          | urgency (`low/normal/high`)                                                    | P2    | off     |
| `ai.transcribe_audio` | transcribe voice notes → `message.transcript`                                  | P2    | off     |
| `ai.describe_image`   | describe/categorise image → `message.media_description`                        | P2    | off     |
| `ai.extract_brief`    | extract order brief (§11)                                                      | P2    | off     |
| `ai.suggest_reply`    | create `outbound_message` draft (`origin='ai_suggestion'`, `pending_approval`) | P2    | off     |

### 10.2 `LlmClient` interface

```ts
interface LlmClient {
  provider: string; // 'openai'
  completeJson<T>(args: {
    model: string;
    system: string;
    user: string;
    schemaName: string;
    jsonSchema: object;
    temperature?: number;
    maxOutputTokens?: number;
    images?: { mime: string; dataBase64: string }[];
  }): Promise<{
    data: T;
    usage: { in: number; out: number };
    latencyMs: number;
    model: string;
  }>;
  transcribe(args: {
    model: string;
    audio: Buffer;
    mime: string;
    language?: string;
  }): Promise<{ text: string; latencyMs: number; model: string }>;
}
```

The OpenAI implementation uses Structured Outputs (`response_format: { type: 'json_schema', json_schema: { name, schema, strict: true } }`), `temperature: 0`.

### 10.3 Classification step (P1)

**When:** every inbound message with `type ∈ {text, image, audio, video, document, sticker, location, contacts, interactive, button}`. Never for `reaction` or `unsupported`.

**Captionless media rule:** an image/audio/video/document/sticker with no caption is classified with `startAfter = AI_CLASSIFY_MEDIA_LOOKAHEAD_SECONDS` (60 s). Its input includes up to 3 inbound messages from the same contact that arrive within 60 s **after** it (lookahead), so "image + 'how much for 50?'" is classified together. Audio with `FF:ai.transcribe_audio` on: classification waits for the transcript (enqueued by the transcribe step; max wait 5 min, then classify without it).

**Labels** (exactly one):

| Label       | Definition                                                                                                                                                                                                                                                  | Examples                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `order`     | The customer gives, changes, confirms, defers or asks about **specifics of a purchase they intend or already have**: product + quantity/colour/size/design/deadline/delivery, acceptance, payment made, order status, changes to an existing order or quote | "polos for staff", "maybe 80, navy", "make it 200", "let me discuss with my team" (replying to a quote), "I've paid", "is my order ready?" |
| `inquiry`   | General questions or first contact **without purchase specifics beyond a quantity**: prices, catalogue, availability, location, hours, "do you make X", greetings, "how much for 50?" with no product spec                                                  | "Good morning", "how much is a polo?", "make something like this, how much for 50?"                                                        |
| `complaint` | Dissatisfaction or a problem: lateness, wrong/defective item, poor service, refund request, threat to escalate                                                                                                                                              | "It's 3 days late", "the print is peeling", "I want my money back"                                                                         |
| `spam`      | Unsolicited promotions, scams, phishing, irrelevant bulk messages, wrong-number solicitations, bots                                                                                                                                                         | "Earn ₦50k daily, click…", crypto offers, loan adverts                                                                                     |

**Tie-breakers** (in the prompt and the labelling guide):

1. `complaint` beats `order` beats `inquiry` when a message contains several intents.
2. Uncertain between `spam` and anything else → choose the non-spam label (we never want to hide real customers).
3. A greeting-only message → `inquiry`.
4. Context matters: a short reply ("ok", "noted", "let me discuss") in a conversation with an open quote → `order`.

**Input** (built by `buildInput`, ≤ 4,000 chars):

```json
{
  "message": {
    "id": "<uuid>",
    "type": "text",
    "text": "maybe 80, navy",
    "caption": null,
    "media_description": null,
    "transcript": null
  },
  "lookahead": [{ "type": "text", "text": "how much for 50?" }],
  "context": [
    {
      "role": "customer|staff",
      "type": "text",
      "text": "polos for staff",
      "minutes_before": 3
    }
  ],
  "conversation_has_open_order": false,
  "conversation_has_sent_quote": false
}
```

`context` = up to the 6 previous messages in the conversation (both directions, text/caption/transcript only).

**System prompt** (`packages/ai/src/prompts/classify-v1.0.0.md`). Stored verbatim; any change bumps `promptVersion`.

```
You classify ONE inbound WhatsApp message sent to MMABON, a Nigerian custom-apparel business.
Return exactly one label: inquiry | complaint | order | spam, using the definitions and tie-breakers below.
Use the context and lookahead only to understand the message; classify the MESSAGE.
Nigerian English and Pidgin are common; "abeg", "how far", "na" etc. are normal, not spam.
Definitions: <definitions table verbatim>
Tie-breakers: <tie-breakers verbatim>
Return JSON matching the schema. "confidence" is your probability (0–1) that the label is correct.
"rationale" ≤ 200 characters, factual, quoting the decisive words. Do not invent facts.
```

**Output JSON schema** (Zod → JSON Schema; `strict: true`):

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["label", "confidence", "rationale", "signals"],
  "properties": {
    "label": {
      "type": "string",
      "enum": ["inquiry", "complaint", "order", "spam"]
    },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "rationale": { "type": "string", "maxLength": 200 },
    "signals": {
      "type": "array",
      "maxItems": 5,
      "items": { "type": "string", "maxLength": 40 }
    }
  }
}
```

**Persist:**

- `message.classification = label`
- `classification_confidence = round(confidence, 3)`
- `classification_model = provider + ':' + model`
- `classification_prompt_version`
- `classification_ai_run_id`
- `classified_at = now()`
- `classification_needs_review = confidence < AI_CLASSIFY_CONFIDENCE_REVIEW_THRESHOLD OR label = 'spam'`
- `conversation.last_inbound_class`

Then broadcast `message.classified`.

**Behaviour rules:**

- Classification **never** sends messages, blocks contacts, or hides conversations.
- `spam` conversations go to the _Spam_ tab, but still trigger notifications for the first message from a new contact.

**Staff override:** `POST /api/messages/:id/classification-override {label}` (roles: admin, sales, manager). It sets the `classification_override*` fields and writes `audit_log`. The original AI label is kept. Overrides feed the eval set.

**Backfill:** `scripts/backfill-classify.ts --prompt-version classify-v1.1.0 --since 2026-11-01` enqueues jobs. Never automatic.

**AC-CLS-1:** every classifiable inbound message has `classification` non-null within 10 s (p95) of ingest when the flag is on.
**AC-CLS-2:** `reaction` and `unsupported` messages are never classified.
**AC-CLS-3:** the captionless image + follow-up text within 60 s are classified with the lookahead included (check `ai_run.input`).
**AC-CLS-4:** an override keeps the original label and creates an audit row.
**AC-CLS-5:** eval targets in §10.5 are met on the held-out set before `ai.classify` is enabled in production.

### 10.4 P2 steps (contracts)

- **`urgency`:** output `{level: 'low'|'normal'|'high', reasons: string[]≤3}`. `high` if: complaint with a deadline ≤ 72 h, event date ≤ 7 days, payment problem, or threat to escalate. Persist `message.urgency`. The inbox sorts high first when the "Urgent" filter is on.
- **`transcribe_audio`:** model `AI_TRANSCRIBE_MODEL`, input ogg/opus from Storage. Persist `message.transcript`. The UI shows the transcript under the audio player with an "AI transcript – check audio" label. Staff may edit it (edits write audit_log).
- **`describe_image`:** output `{kind: 'reference_design'|'logo'|'size_chart'|'fabric_swatch'|'payment_receipt'|'product_photo'|'other', description: string≤300, visible_text: string≤300}`. Persist `message.media_description`. **R-1:** never used to fill order fields.
- **`suggest_reply`:** input = last 20 messages + order brief + approved quote (if any) + open clarification questions. Output `{text: string≤1000, uses_template: false, cites_message_ids: uuid[], mentions: {amounts_kobo:number[], dates:string[], quantities:number[]}}`.
  - Validator: every amount must equal a quote/rule output, and every date and quantity must appear in the brief or messages (R-1 #5). Otherwise reject.
  - Persist as `outbound_message(kind='text', origin='ai_suggestion', status='pending_approval', ai_run_id)`.
  - If the window is closed → do not create a suggestion; create a `followup` instead.
- **`extract_brief`:** §11.3.

### 10.5 Classification evaluation

- **Dataset:** `eval/classification/labelled.jsonl`. One line per message: `{"id","fixture","message_index","text","context":[...],"gold":"order","labeller_a":"order","labeller_b":"order","notes":""}`.
- **Size and mix (minimum by the end of week 3):** 400 messages = 120 inquiry, 120 order, 80 complaint, 80 spam, including ≥ 60 in Nigerian Pidgin or mixed English/Pidgin, ≥ 30 captionless-media cases, and ≥ 40 short context-dependent replies.
- **Sources:**
  - (a) the fixture conversations (§17.2)
  - (b) additional synthetic messages written by the team from MMABON's description of typical chats
  - (c) after go-live, staff overrides (sampled weekly)
- **Labelling:** two labellers per item, following the labelling guide (`eval/classification/GUIDE.md` = §10.3 definitions + tie-breakers + 5 examples per label). Disagreements are resolved by a third person. Report Cohen's κ (target ≥ 0.80).
- **Split:** 30% dev (prompt iteration), 70% held-out test (frozen; never used for prompt tuning).
- **Runner:** `pnpm eval:classify --model $M --prompt classify-v1.0.0`. It writes `eval/classification/reports/{date}-{model}-{prompt}.json` + `.md` with: accuracy, per-class precision/recall/F1, macro-F1, confusion matrix, calibration (reliability table in 0.1 bins), p50/p95 latency, cost per 1,000 messages.

**Targets (held-out set; gate for production enablement and for any prompt or model change):**

| Metric                                    | Target |
| ----------------------------------------- | ------ |
| Accuracy                                  | ≥ 0.90 |
| Macro-F1                                  | ≥ 0.85 |
| `complaint` recall                        | ≥ 0.90 |
| `order` recall                            | ≥ 0.90 |
| `spam` precision                          | ≥ 0.95 |
| Share of `needs_review` flagged           | ≤ 15%  |
| Of items with confidence ≥ 0.70, accuracy | ≥ 0.93 |
| p95 latency per message                   | ≤ 4 s  |

- **CI:** `pnpm eval:classify --ci` runs on the held-out set when `packages/ai/src/steps/classify*` or `prompts/classify*` change. It fails the build if macro-F1 drops more than 0.02 below the last accepted report (`eval/classification/baseline.json`).

### 10.6 Grounding validator (R-1), used by `extract_brief` and `suggest_reply`

For each candidate value with `status ∈ {confirmed, provisional}`:

1. `evidence_message_ids` must be non-empty and must all belong to the conversation. Each evidence message must be from the **customer**, or from staff when the field is `staff-stated`.
2. Evidence text = `text_body ∪ caption ∪ transcript` of the evidence messages, lowercased, with numbers normalised (e.g. "eighty" → 80, "1.5m" → 1500000).
3. Per value type:
   - **integer** (qty, sizes): the number must appear in the evidence text. Sums (e.g. a total from 40+40+40) are allowed only when `derivation: 'sum'` lists the component evidence.
   - **money** (budget): the amount must appear (accept "2m", "2,000,000", "₦2million", "N2m").
   - **date**: the evidence must contain a date expression. The resolved date is computed by code (`chrono-node`, ref date = evidence `wa_timestamp`, timezone Africa/Lagos), never by the LLM.
   - **enum/text** (colour, product, cut, fabric, decoration): the value or a synonym from `packages/domain/synonyms.ts` must appear in the evidence text (e.g. "wine" ≈ "burgundy" ≈ "maroon"). Images are not evidence for these fields.
4. Failure → set `status='missing'`, `value=null`, and add `{field, code:'GROUNDING_FAILED'}` to `validation_errors`.
5. `assumed` is allowed only when `default_rule_id` refers to an enabled rule whose `field_key` matches. Otherwise → `missing`.
6. **Hedge rule:** if the evidence sentence contains a hedge (`maybe|about|around|roughly|probably|or so|abi|i think`) or ends with `?` → the status may not be `confirmed`; downgrade it to `provisional`.

---

## 11. Orders domain

### 11.1 Stages, sub-status and transitions

`order_stage`: `new_enquiry → awaiting_details → quoted → negotiating → confirmed → paid → in_production → fulfilled`, with `lost` reachable from any stage before `fulfilled`.

`waiting_on` (independent of stage):

- `none`
- `customer_details` (clarifications open)
- `customer_decision` (quote sent, the customer deferred or is silent)
- `customer_approval` (artwork or substitution awaiting OK)
- `internal`

The UI label is `"{Stage} · {Waiting on}"`, e.g. **"Quoted · Awaiting customer decision"**.

| From → To                            | Who                                                       | Guard (all must hold)                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (create) → `new_enquiry`             | sales, admin, manager                                     | Created from a conversation (`POST /api/orders`)                                                                                                                                                                                |
| `new_enquiry` → `awaiting_details`   | sales, admin, manager, or system after `extract_brief`    | ≥ 1 open clarification or missing required field                                                                                                                                                                                |
| any pre-`quoted` → `quoted`          | sales, admin, manager                                     | A quote exists with `status='sent'` (sending a quote sets this automatically)                                                                                                                                                   |
| `quoted` → `negotiating`             | sales, admin, manager, or system                          | A customer message classified `order` arrived after the quote, and the brief diff contains ≥ 1 change (§11.4)                                                                                                                   |
| `quoted`/`negotiating` → `confirmed` | **staff only** (sales, admin, manager)                    | (1) a staff click; (2) `acceptance_message_id` given, pointing to a customer message; (3) no required field `missing` (§11.2), or a manager override with a reason; (4) the latest quote is `accepted` (set in the same action) |
| `confirmed` → `paid`                 | system (Paystack) or admin (manual transfer with receipt) | `payment_request.status='paid'` with `kind ∈ {deposit, full}`, or a manual payment entry by admin                                                                                                                               |
| `paid` → `in_production`             | production, admin, manager                                | No `assumed` or `missing` required fields; artwork approved if decoration ≠ none                                                                                                                                                |
| `in_production` → `fulfilled`        | dispatch, admin, manager                                  | Balance paid or a manager override                                                                                                                                                                                              |
| any → `lost`                         | sales, admin, manager                                     | `lost_reason` required                                                                                                                                                                                                          |

- **The AI can never set `confirmed`, `paid` or `fulfilled`.** This is enforced in `packages/domain/orders/transition.ts` (`actor_kind='ai'` → throw `AI_TRANSITION_FORBIDDEN`). **Test:** `orders-ai-cannot-confirm`.
- Every transition writes a `change_event(kind='stage_change')` + `audit_log`.

### 11.2 Field catalogue (`order_field.key`)

Required fields block confirmation if `missing`.

| Key                | Type                                                                          | Required to confirm | Notes                                    |
| ------------------ | ----------------------------------------------------------------------------- | ------------------- | ---------------------------------------- |
| `customer_name`    | text                                                                          | ✔                   |                                          |
| `organisation`     | text                                                                          |                     | e.g. company, church, reunion group      |
| `purpose`          | text                                                                          |                     | "staff uniform", "reunion"               |
| `need_by`          | date                                                                          | ✔                   | Date the goods must be with the customer |
| `event_date`       | date                                                                          |                     |                                          |
| `delivery_method`  | enum `delivery\|pickup`                                                       | ✔                   |                                          |
| `delivery_address` | text                                                                          | ✔ if delivery       |                                          |
| `budget`           | money (kobo)                                                                  |                     |                                          |
| `artwork_status`   | enum `none_needed\|awaited\|received\|in_design\|sent_for_approval\|approved` | ✔ (≠ awaited)       |                                          |
| `logo_required`    | boolean                                                                       |                     |                                          |
| `notes`            | text                                                                          |                     | Image descriptions go here (R-1)         |

Line items (`order_line_item.attributes`):

| Attribute                                      | Required to confirm    |
| ---------------------------------------------- | ---------------------- |
| `fabric`                                       | ✔                      |
| `decoration` (`screen\|dtf\|embroidery\|none`) | ✔                      |
| `placement`                                    | ✔ if decoration ≠ none |

Each attribute is `{value, status, evidence[]}`. Variants and sizes: the variant `qty` is required; the size breakdown is required (sum = variant qty).

### 11.3 `extract_brief` step (P2, `FF:ai.extract_brief`)

**Trigger:** manual button "Extract brief" in the thread, or on_ingest for messages classified `order` when the flag is on (debounced: `startAfter` 90 s, singleton per conversation, so bursts collapse into one run).

**Input:**

- all messages in the conversation since the order was created (or the last 50 if there's no order), each as `[m:<uuid>] <iso time> <customer|staff>: <text | caption | transcript | "[image: <media_description or 'no description'>]">`
- the current brief (JSON)
- the product catalogue codes
- enabled `default_rule` rows
- `today` in Africa/Lagos

**Prompt** (`extract-brief-v1.0.0.md`), key instructions:

- "Only use information stated in the messages."
- "If unsure → provisional; if absent → missing."
- "Never use the image description for product/fabric/colour/decoration/qty/size/price."
- "Return raw date phrases (`need_by_phrase`), not computed dates."
- "Report changes vs the current brief in `changes[]`."
- "Write clarification questions for missing/provisional required fields, short, Nigerian-English polite tone."

**Output schema** (strict):

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "fields",
    "line_items",
    "personalisation",
    "changes",
    "clarifications"
  ],
  "properties": {
    "fields": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["key", "value", "status", "evidence", "date_phrase"],
        "properties": {
          "key": {
            "type": "string",
            "enum": [
              "customer_name",
              "organisation",
              "purpose",
              "need_by",
              "event_date",
              "delivery_method",
              "delivery_address",
              "budget",
              "artwork_status",
              "logo_required",
              "notes"
            ]
          },
          "value": { "type": ["string", "number", "boolean", "null"] },
          "status": {
            "type": "string",
            "enum": ["confirmed", "provisional", "assumed", "missing"]
          },
          "evidence": { "type": "array", "items": { "type": "string" } },
          "date_phrase": { "type": ["string", "null"] }
        }
      }
    },
    "line_items": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "ref",
          "product_label",
          "product_code",
          "attributes",
          "variants",
          "removed"
        ],
        "properties": {
          "ref": { "type": "string" },
          "product_label": { "type": "string" },
          "product_code": { "type": ["string", "null"] },
          "removed": { "type": "boolean" },
          "attributes": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["name", "value", "status", "evidence"],
              "properties": {
                "name": {
                  "type": "string",
                  "enum": ["fabric", "decoration", "placement"]
                },
                "value": { "type": ["string", "null"] },
                "status": {
                  "type": "string",
                  "enum": ["confirmed", "provisional", "assumed", "missing"]
                },
                "evidence": { "type": "array", "items": { "type": "string" } }
              }
            }
          },
          "variants": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "colour",
                "cut",
                "qty",
                "status",
                "evidence",
                "sizes"
              ],
              "properties": {
                "colour": { "type": ["string", "null"] },
                "cut": { "type": ["string", "null"] },
                "qty": { "type": ["integer", "null"] },
                "status": {
                  "type": "string",
                  "enum": ["confirmed", "provisional", "assumed", "missing"]
                },
                "evidence": { "type": "array", "items": { "type": "string" } },
                "sizes": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["size", "qty", "status", "evidence"],
                    "properties": {
                      "size": { "type": "string" },
                      "qty": { "type": ["integer", "null"] },
                      "status": {
                        "type": "string",
                        "enum": [
                          "confirmed",
                          "provisional",
                          "assumed",
                          "missing"
                        ]
                      },
                      "evidence": {
                        "type": "array",
                        "items": { "type": "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "personalisation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["required", "status", "evidence", "details_missing"],
      "properties": {
        "required": { "type": ["boolean", "null"] },
        "status": {
          "type": "string",
          "enum": ["confirmed", "provisional", "missing"]
        },
        "evidence": { "type": "array", "items": { "type": "string" } },
        "details_missing": { "type": "array", "items": { "type": "string" } }
      }
    },
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "op",
          "target",
          "before",
          "after",
          "evidence",
          "is_question"
        ],
        "properties": {
          "op": {
            "type": "string",
            "enum": ["set", "remove_line_item", "add_line_item"]
          },
          "target": { "type": "string" },
          "before": { "type": ["string", "number", "null"] },
          "after": { "type": ["string", "number", "null"] },
          "evidence": { "type": "array", "items": { "type": "string" } },
          "is_question": { "type": "boolean" }
        }
      }
    },
    "clarifications": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["field_key", "question", "priority"],
        "properties": {
          "field_key": { "type": "string" },
          "question": { "type": "string", "maxLength": 200 },
          "priority": { "type": "integer", "minimum": 1, "maximum": 10 }
        }
      }
    }
  }
}
```

**Post-processing in code, in order:**

1. Map `m:<uuid>` evidence to message IDs, and drop unknown IDs.
2. Grounding validator (§10.6), including the hedge rule.
3. Resolve `date_phrase` with chrono-node (reference = evidence message time; a future date is preferred). Store the ISO date. The status stays `provisional` if the phrase was a question.
4. Reconcile totals: if variant quantities sum ≠ the stated total → add `risk_reasons` "Quantities don't add up" and set the affected statuses to `provisional`.
5. Never split a quantity across variants unless the split is stated (`r1-no-invented-split` test).
6. Apply changes (§11.4).
7. Upsert `order_field`, line items, variants, sizes and personalisation, each with `set_by='ai'` and `ai_run_id`. **Never overwrite a field where `set_by='staff'`**: create a "Change to review" suggestion instead.
8. Insert `clarification_question` rows (dedupe by `field_key`, keeping the open one).
9. If `FF:feasibility.engine` → enqueue `orders.recompute_risk`.

### 11.4 Change handling

- **Pre-confirmation** (`stage ∈ {new_enquiry, awaiting_details, quoted, negotiating}`): changes apply directly to the brief, and each writes a `change_event` (kind `field_change`/`line_item_removed`/`variant_change`) with before/after/evidence. If a quote with `status='sent'` exists and a priced attribute changed (qty, product, decoration, colour surcharge, line removed) → create a new `quote` version as `draft` (§11.5) and mark the previous one `superseded`. The stage moves to `negotiating`.
- **Post-confirmation** (`confirmed` and later): changes are **not applied**. Each one creates a `change_event` with `needs_customer_ack=false`, plus a "Change to review" card for admin. Once admin accepts it, the change applies, and departments in `notify_roles` (design for artwork/colour, production for qty/fabric/sizes, dispatch for address/date) must acknowledge. Production can't start the affected items until all acknowledge.
- `is_question=true` changes (e.g. "still by Monday?") do **not** change values. They create a clarification/feasibility check.
- Removing a line item = soft delete (`removed_at`). Undo is available for 7 days.

### 11.5 Pricing engine (`packages/domain/pricing.ts`, deterministic, no AI)

`priceLineItem(item, variants, rules, today)`:

1. Select enabled `price_rule` rows where `product_code` matches, `decoration` matches or is null, `min_qty ≤ totalQty ≤ max_qty` (null = ∞), and `valid_from ≤ today ≤ valid_to`. If there are several, choose the most specific (decoration not null > null), then the latest `valid_from`.
2. No rule → `{priced:false, reason:'NO_RULE'}`. The quote line shows "Staff to price" and must be filled manually before sending.
3. `unit = rule.unit_kobo + addons` (e.g. `back_name_kobo` × names count / qty, applied per personalised item).
4. A rush surcharge applies **only** if staff tick "Rush" (never automatic).

The quote total is computed in code. Staff can override any unit price (logged).

`indicativeRange(productCodes[], qty)` = min/max over candidate rules. It's used only for inquiry estimates and labelled **"Estimate, not a quote"**.

**AC-PRC-1:** with no rules, the quote builder can't auto-price, and sending is blocked until every line has a price.
**AC-PRC-2:** a tier change at 200 units is applied when the qty changes 150 → 200.

### 11.6 Feasibility engine (P2, `FF:feasibility.engine`)

`productionDaysNeeded = Σ_processes ceil(qty / units_per_day) + max(setup_days) + artwork_days` (from `lead_time_rule`).

`availableDays` = working days (Mon–Sat; public holidays from `packages/shared/holidays-ng.ts`) between `max(today, artwork approval date)` and `need_by − 1 day (delivery buffer)`, minus days where `capacity_day.booked_units ≥ capacity_units` for the bottleneck process.

| Condition                          | Risk level |
| ---------------------------------- | ---------- |
| `need_by` missing                  | `unknown`  |
| needed ≤ available − 2             | `ok`       |
| needed ≤ available                 | `watch`    |
| needed > available                 | `at_risk`  |
| `need_by` passed and not fulfilled | `late`     |

Reasons are human-readable strings, e.g. `"Needs 7 production days; 4 available before Mon 26 Oct"`.

**Budget check:** if `budget` and pricing are available → `budget_per_unit = budget/qty`, compared with the estimated unit. If it's over by more than 0% → reason `"Estimate ₦X–₦Y exceeds budget ₦Z"`.

### 11.7 Follow-ups (P2 generator; the manual list is P1b)

- Staff can always add a manual follow-up (`reason='manual'`).
- **Generator rules** (`FF:followups.generator`, cron every 15 min):

| Reason             | Created when                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `awaiting_details` | open clarifications asked > 24 h ago with no inbound since                                                                                           |
| `quote_no_reply`   | quote sent > 48 working hours ago with no inbound since, **or** `waiting_on='customer_decision'` and 2 working days since `last_customer_contact_at` |
| `balance_due`      | deposit paid, balance unpaid, 3 days before `need_by`                                                                                                |

- Each follow-up gets a draft `outbound_message`:
  - window open → `kind='text'`, `origin='followup'`, `status='pending_approval'`
  - window closed → `kind='template'` (`followup_general` or `quote_ready`) with params filled from DB fields, `pending_approval`
- Auto-sending follow-ups requires `AS:auto_send.followup_reminders` (default off).
- After 2 follow-ups with no reply → suggest "Mark lost?" in the UI (never automatic).

---

## 12. Paystack integration

### 12.1 Flow

1. Staff open the **Quote builder**, price the lines, and save. `quote.status='draft'`.
2. **Send quote:** this creates an `outbound_message` with the quote summary (or the `quote_ready` template if the window is closed). An approver sends it. `quote.status='sent'`, and the order stage becomes `quoted`.
3. **Create payment link** (button on a sent or accepted quote; roles: sales, admin, manager; `FF:payments.paystack` on). Choose `kind` (`deposit` with % or amount, `balance`, or `full`).
   Server: `POST https://api.paystack.co/transaction/initialize` with `Authorization: Bearer PAYSTACK_SECRET_KEY` and body:
   ```json
   {
     "email": "<contact.email or wa{wa_id}@PAYSTACK_FALLBACK_EMAIL_DOMAIN>",
     "amount": "<amount_kobo as string>",
     "currency": "NGN",
     "reference": "MMB-Q-0142-v2-DEP-1",
     "callback_url": "<PAYSTACK_CALLBACK_URL>",
     "metadata": "{\"payment_request_id\":\"<uuid>\",\"order_id\":\"<uuid>\",\"quote_id\":\"<uuid>\",\"kind\":\"deposit\"}"
   }
   ```
   Response: `{status:true, data:{authorization_url, access_code, reference}}` → stored on `payment_request` (`status='created'`).
   The reference format is `{quote.ref}-v{version}-{DEP|BAL|FULL}-{n}`, allowed characters `[A-Za-z0-9.=-]`.
4. A draft `outbound_message` (`origin='payment_link'`, `pending_approval`) is created:
   - window open: `"Here is your secure Paystack link for {order ref} ({kind}, ₦{amount}): {authorization_url}"`
   - window closed: template `payment_link`

   After approval and send → `payment_request.status='link_sent'`.

5. Paystack POSTs events to `${APP_BASE_URL}/api/webhooks/paystack` (configured in the Paystack Dashboard → Settings → API Keys & Webhooks).

### 12.2 `POST /api/webhooks/paystack`

1. Raw body. If `PAYSTACK_ENFORCE_IP_ALLOWLIST` is on, reject IPs other than `52.31.139.75`, `52.49.173.169`, `52.214.14.220` (from `x-forwarded-for`, first hop per Vercel).
2. `expected = hmacSHA512(PAYSTACK_SECRET_KEY, raw).hex`. Compare with the `x-paystack-signature` header (timing-safe). Invalid → store `signature_valid=false`, return 401.
3. Insert `webhook_event(source='paystack', dedupe_key=sha256(raw))` + enqueue `paystack.process_event` in one transaction. Return 200 immediately. Paystack retries non-200 responses (live: every 3 min ×4, then hourly for 72 h).

### 12.3 `paystack.process_event`

- `event === 'charge.success'`:
  1. `reference = data.reference`. Find `payment_request` by `paystack_reference`. Not found → mark the event processed with `process_error='UNKNOWN_REFERENCE'` and alert.
  2. If it's already `paid` → no-op (R-4).
  3. **Verify:** `GET https://api.paystack.co/transaction/verify/{reference}`. Require `data.status === 'success'`, `data.amount === amount_kobo`, `data.currency === 'NGN'`. On mismatch → `status='amount_mismatch'`, `raw_verify`, alert the admin; the stage is not changed.
  4. Set `status='paid'`, `paid_at=data.paid_at`, `channel=data.channel`, `fees_kobo=data.fees`, `verified_at=now()`.
  5. If the order stage is `confirmed` and `kind ∈ {deposit, full}` → transition to `paid` (actor system). If the stage is earlier (customer paid before staff confirmed) → **do not auto-confirm**. Set `waiting_on='internal'`, show the order flag "Payment received – confirm order", and notify sales.
  6. `change_event(kind='payment')`, `audit_log`, broadcast `payment.paid`.
  7. If `AS:auto_send.payment_received_ack` is enabled → create an auto outbound "Thank you, we've received ₦X for {ref}." (`origin='system_auto'`, `auto_sent=true`). Otherwise create a `pending_approval` draft.
- Other events (`charge.failed` if received, `refund.*`): store, and set the matching `payment_request.status` (`failed`, `cancelled`) where applicable. No stage change.
- **Manual bank transfer:** admin can record a payment (`POST /api/orders/:id/payments/manual {amount_kobo, paid_at, note, receipt_message_id}`). It creates a `payment_request` with `paystack_reference = 'MANUAL-'+uuid`, `status='paid'`, and an audit row.

**AC-PAY-1:** a test-mode payment via `authorization_url` → the webhook marks it paid within 30 s and the order moves `confirmed → paid`.
**AC-PAY-2:** a forged signature → 401, no state change.
**AC-PAY-3:** the same webhook delivered twice → one state change.
**AC-PAY-4:** an amount mismatch → `amount_mismatch`, stage unchanged, alert.
**AC-PAY-5:** payment on an unconfirmed order → not auto-confirmed; the flag is shown.

Fees for reference (dashboard only): local 1.5% + ₦100 (₦100 waived under ₦2,500), capped at ₦2,000; international 3.9% + ₦100; settlement T+1.

---

## 13. Approvals and automation settings

### 13.1 Approval rules

| Actor role                     | Compose & Send           | Submit for approval | Approve/Reject others' drafts |
| ------------------------------ | ------------------------ | ------------------- | ----------------------------- |
| admin, sales, manager          | ✔ (`approved_by = self`) | ✔                   | ✔                             |
| designer, production, dispatch | ✘                        | ✔                   | ✘                             |

- AI drafts (`ai_suggestion`, `followup`, `payment_link`, `quote`) always start as `pending_approval`.
- An approver may edit the text before approving. The edited text replaces `body_text`, and the original is kept in `audit_log.before`.
- Rejecting requires a reason.
- A draft older than 24 h in `pending_approval` whose window has since closed → automatically set to `cancelled`, with the note "Window closed – use a template".

### 13.2 Automation settings (all default OFF; admin-only; audited)

| Key                              | `allowed_origin` | What it allows when enabled                                     | Config                                                                                                  |
| -------------------------------- | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `auto_send.read_receipts`        | `system_auto`    | Send a `status:read` receipt when a staff member opens a thread | `{}`                                                                                                    |
| `auto_send.payment_received_ack` | `system_auto`    | Auto-send a payment thank-you (§12.3)                           | `{ "template_when_window_closed": "order_update" }`                                                     |
| `auto_send.out_of_hours_ack`     | `system_auto`    | One reply per conversation per night outside business hours     | `{ "hours": { "mon_sat": ["08:00","19:00"] }, "text": "…" }` (text must be approved in the Settings UI) |
| `auto_send.followup_reminders`   | `followup`       | Send generated follow-ups at `due_at` without approval          | `{ "max_per_conversation": 2 }`                                                                         |

UI rule: enabling any setting requires typing the setting name to confirm. A red banner "Automatic sending is ON for: …" shows on every page while any setting is enabled.

---

## 14. Auth, roles and permissions

- Supabase Auth email + password. Public sign-up is disabled. An admin invites users (`POST /api/users/invite {email, full_name, role}`). Password reset by email.
- Session: Supabase SSR cookies (`@supabase/ssr`). Every `/api/*` handler calls `requireRole(roles[])`, which returns 401 (no session) or 403 (wrong role or inactive).
- The first admin is created by `scripts/create-admin.ts --email --name`.

**Permission matrix** (✔ = allowed):

| Capability                                | admin | manager | sales         | designer                                                         | production                        | dispatch             |
| ----------------------------------------- | ----- | ------- | ------------- | ---------------------------------------------------------------- | --------------------------------- | -------------------- |
| View inbox & threads                      | ✔     | ✔       | ✔             | ✔                                                                | ✔                                 | ✔                    |
| Send / approve outbound                   | ✔     | ✔       | ✔             |                                                                  |                                   |                      |
| Submit outbound for approval              | ✔     | ✔       | ✔             | ✔                                                                | ✔                                 | ✔                    |
| Assign conversations                      | ✔     | ✔       | ✔             |                                                                  |                                   |                      |
| Override classification                   | ✔     | ✔       | ✔             |                                                                  |                                   |                      |
| Create/edit orders & brief fields         | ✔     | ✔       | ✔             | design fields only (`artwork_status`, `placement`, `decoration`) | production fields only (`fabric`) | delivery fields only |
| Confirm order (stage)                     | ✔     | ✔       | ✔             |                                                                  |                                   |                      |
| Move to in_production / fulfilled         | ✔     | ✔       |               |                                                                  | ✔ (in_production)                 | ✔ (fulfilled)        |
| Quotes & payment links                    | ✔     | ✔       | ✔             |                                                                  |                                   |                      |
| Record manual payment                     | ✔     | ✔       |               |                                                                  |                                   |                      |
| See prices & payments                     | ✔     | ✔       | ✔             |                                                                  |                                   |                      |
| Dashboard                                 | ✔     | ✔       | ✔ (own stats) |                                                                  |                                   |                      |
| Pricing/lead-time/default rules           | ✔     | ✔       |               |                                                                  |                                   |                      |
| Feature flags, automation settings, users | ✔     |         |               |                                                                  |                                   |                      |
| WhatsApp numbers (refresh / set active)   | ✔     |         |               |                                                                  |                                   |                      |
| Audit log                                 | ✔     | ✔       |               |                                                                  |                                   |                      |

**Test:** `perm-matrix.test.ts` iterates over every row × role against the API.

---

## 15. HTTP API (route handlers under `apps/web/app/api`)

**Conventions:**

- JSON in and out.
- Errors use `{error:{code, message}}` with HTTP 400 (validation), 401, 403, 404, 409 (conflict/state), 422 (rule violation, e.g. `WINDOW_CLOSED`, `R2_NOT_APPROVED`), or 500.
- Lists are cursor-paginated `?cursor=<opaque>&limit=50` and return `{items, nextCursor}`.
- All mutations require `Idempotency-Key` (UUID), stored for 24 h in table `api_idempotency` (§7.4). A repeated key from the same user returns the stored response.

| Method & path                                                                       | Roles                       | Body / query                                                                                                                                                   | Result                                                                                                                |
| ----------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET `/api/webhooks/whatsapp`                                                        | public                      | hub.\*                                                                                                                                                         | challenge / 403                                                                                                       |
| POST `/api/webhooks/whatsapp`                                                       | public (signed)             | raw                                                                                                                                                            | 200/401                                                                                                               |
| POST `/api/webhooks/paystack`                                                       | public (signed)             | raw                                                                                                                                                            | 200/401                                                                                                               |
| GET `/api/health`                                                                   | public                      |                                                                                                                                                                | `{db:'ok',queue:'ok',version}`                                                                                        |
| GET `/api/conversations`                                                            | all                         | `status, assigned=me\|unassigned\|<id>, class=inquiry\|complaint\|order\|spam, needs_review=true, q`                                                           | list with contact, preview, `last_inbound_class`, `unread_count`, `window_expires_at`                                 |
| GET `/api/conversations/:id`                                                        | all                         |                                                                                                                                                                | conversation + contact + window info + open order summary                                                             |
| GET `/api/conversations/:id/messages`                                               | all                         | `cursor, limit` (newest first)                                                                                                                                 | messages with media `{status, url:/api/media/:id}`                                                                    |
| POST `/api/conversations/:id/read`                                                  | all                         |                                                                                                                                                                | resets `unread_count`; if `AS:auto_send.read_receipts` is on → enqueue a read receipt                                 |
| PATCH `/api/conversations/:id`                                                      | admin, sales, manager       | `{assigned_to?, status?, snoozed_until?}`                                                                                                                      | updated                                                                                                               |
| POST `/api/conversations/:id/outbound`                                              | all (send: SEND_ROLES)      | `{kind, body_text?, media_asset_id?, media_caption?, template_id?, template_params?, reply_to_wamid?, action:'send'\|'submit'\|'save_draft', idempotency_key}` | `outbound_message` (`approved`/`pending_approval`/`draft`); 422 `WINDOW_CLOSED` for free-form when closed             |
| POST `/api/outbound/:id/approve`                                                    | SEND_ROLES                  | `{body_text?}` (edit)                                                                                                                                          | approved + enqueued                                                                                                   |
| POST `/api/outbound/:id/reject`                                                     | SEND_ROLES                  | `{reason}`                                                                                                                                                     | rejected                                                                                                              |
| POST `/api/outbound/:id/cancel`                                                     | creator or SEND_ROLES       |                                                                                                                                                                | cancelled                                                                                                             |
| POST `/api/outbound/:id/retry`                                                      | SEND_ROLES                  |                                                                                                                                                                | allowed only if `failed` and not `needs_manual_check` (or with `{confirm_manual_check:true}`) → `approved` + enqueued |
| GET `/api/approvals`                                                                | SEND_ROLES                  |                                                                                                                                                                | `pending_approval` list                                                                                               |
| POST `/api/media/upload`                                                            | all                         | multipart `file` (≤ 16 MB image/video/audio, ≤ 100 MB document)                                                                                                | `media_asset`                                                                                                         |
| GET `/api/media/:id`                                                                | all                         |                                                                                                                                                                | 302 → signed URL (300 s)                                                                                              |
| POST `/api/messages/:id/classification-override`                                    | admin, sales, manager       | `{label}`                                                                                                                                                      | updated                                                                                                               |
| POST `/api/ai/:step/run`                                                            | admin, sales, manager       | `{conversationId}` (step ∈ extract_brief, suggest_reply)                                                                                                       | `{jobId}`; 409 if the flag is off                                                                                     |
| GET `/api/templates`                                                                | all                         | `status=APPROVED`                                                                                                                                              | list                                                                                                                  |
| POST `/api/templates/sync`                                                          | admin, manager              |                                                                                                                                                                | `{jobId}`                                                                                                             |
| POST `/api/orders`                                                                  | admin, sales, manager       | `{conversationId}`                                                                                                                                             | order (`new_enquiry`)                                                                                                 |
| GET `/api/orders`                                                                   | all                         | `stage, waiting_on, risk, owner, q`                                                                                                                            | list                                                                                                                  |
| GET `/api/orders/:id`                                                               | all (prices hidden by role) |                                                                                                                                                                | full order: fields, line items, variants, sizes, personalisation, clarifications, change events, quotes, payments     |
| PATCH `/api/orders/:id/fields/:key`                                                 | per matrix                  | `{value, status, evidence_message_ids?, note?}`                                                                                                                | field (`set_by='staff'`) + change_event                                                                               |
| POST `/api/orders/:id/line-items` / PATCH `/api/line-items/:id` / DELETE (soft)     | admin, sales, manager       | per §7.5                                                                                                                                                       |                                                                                                                       |
| POST `/api/orders/:id/transition`                                                   | per §11.1                   | `{to, acceptance_message_id?, reason?, override_reason?}`                                                                                                      | order; 422 with the failing guard code                                                                                |
| POST `/api/change-events/:id/accept` / `/acknowledge`                               | admin / notified role       |                                                                                                                                                                | updated                                                                                                               |
| POST `/api/orders/:id/quotes`                                                       | admin, sales, manager       | `{items:[{line_item_id, unit_kobo?}], delivery_kobo, discount_kobo, valid_until}`                                                                              | quote draft (auto-priced where rules exist)                                                                           |
| POST `/api/quotes/:id/send`                                                         | SEND_ROLES                  |                                                                                                                                                                | outbound created (approved by caller) + quote `sent`                                                                  |
| POST `/api/quotes/:id/payment-links`                                                | admin, sales, manager       | `{kind, amount_kobo}`                                                                                                                                          | `payment_request` + draft outbound                                                                                    |
| POST `/api/orders/:id/payments/manual`                                              | admin, manager              | §12.3                                                                                                                                                          | payment                                                                                                               |
| GET `/api/followups`                                                                | all                         | `status=open, due=today\|overdue`                                                                                                                              | list                                                                                                                  |
| POST `/api/followups`                                                               | all                         | `{conversationId, orderId?, due_at, note}`                                                                                                                     | manual follow-up                                                                                                      |
| POST `/api/followups/:id/{done\|snooze\|dismiss}`                                   | all                         | snooze `{until}`, dismiss `{reason}`                                                                                                                           | updated                                                                                                               |
| GET `/api/dashboard/summary`                                                        | admin, manager, sales       | `range=7d\|30d`                                                                                                                                                | §16.9 metrics                                                                                                         |
| GET/PUT `/api/settings/feature-flags[/:key]`                                        | admin                       | `{enabled}`                                                                                                                                                    | audited                                                                                                               |
| GET/PUT `/api/settings/automation[/:key]`                                           | admin                       | `{enabled, config, confirm_key}`                                                                                                                               | audited                                                                                                               |
| GET `/api/settings/whatsapp/numbers`                                                | admin                       |                                                                                                                                                                | list `wa_phone_number` + webhook last-received + token health snapshot                                                |
| POST `/api/settings/whatsapp/numbers/refresh`                                       | admin                       |                                                                                                                                                                | upsert from `GET /{WABA_ID}/phone_numbers`; audited                                                                   |
| POST `/api/settings/whatsapp/numbers/:id/activate`                                  | admin                       |                                                                                                                                                                | set `is_active` (only if `lifecycle='connected'`); audited `wa_phone_number.activate`                                 |
| PATCH `/api/settings/whatsapp/numbers/:id`                                          | admin                       | `{label?}`                                                                                                                                                     | rename label only; audited                                                                                            |
| CRUD `/api/settings/price-rules`, `/lead-time-rules`, `/default-rules`, `/capacity` | admin, manager              | §7.5                                                                                                                                                           | audited                                                                                                               |
| GET `/api/users`, POST `/api/users/invite`, PATCH `/api/users/:id`                  | admin                       |                                                                                                                                                                | audited                                                                                                               |
| GET `/api/audit`                                                                    | admin, manager              | `entity_type, entity_id, actor, from, to`                                                                                                                      | list                                                                                                                  |

---

## 16. Dashboard UI: screens and states

**Global:**

- Desktop-first responsive web app (works on phones ≥ 360 px wide). Left nav: Inbox, Approvals (badge), Orders, Follow-ups, Dashboard, Settings, Audit.
- Header: user, role, **realtime status dot** (green = connected; amber = reconnecting, with "Live updates paused – reconnecting…" banner; red after 30 s).
- **Toasts:** new message (if not viewing that thread), approval needed, system alerts.
- **Common states for every data view:** `loading` (skeletons), `empty` (screen-specific copy), `error` ("Couldn't load. Retry" + Sentry event ID), `forbidden` (403 page "You don't have access to this").
- **Automation banner** (§13.2) when any setting is on.

### 16.1 Login (`/login`)

- Email and password fields; "Forgot password".
- States: idle, submitting, invalid credentials, account deactivated.
- **AC-UI-1:** an inactive user can't log in ("Account disabled – contact admin").

### 16.2 Inbox (`/inbox`)

- **Left pane:** conversation list, sorted by `last_message_at` desc.
  - Tabs: **All · Unassigned · Mine · Orders · Inquiries · Complaints · Spam · Needs review**. Tabs filter by `last_inbound_class`, or `classification_needs_review` on any unreviewed message.
  - Search: name, phone, message text (ILIKE in P1).
  - Row: avatar initials, display/profile name, `+234…` masked except the last 4 for designer/production/dispatch roles, preview, time, unread badge, class chip (colour: order = blue, inquiry = grey, complaint = red, spam = black), window chip, assignee, order ref + stage (if any).
- **Right pane:** thread (§16.3), or the empty state "Select a conversation".
- **Realtime:**
  - `message.created`: moves the row to the top and bumps unread.
  - `message.classified`: updates the chip.
  - A new conversation slides in at the top.
- **States:** loading, empty ("No messages yet. When customers message MMABON on WhatsApp they appear here instantly."), error, reconnecting.

**AC-UI-2:** a replayed inbound message appears at the top of the list ≤ 5 s after POST without a page refresh (Playwright + replay).
**AC-UI-3:** the Complaints tab shows only conversations whose last inbound class is complaint.

### 16.3 Thread view (`/inbox/[conversationId]`)

**Header:**

- Contact name (editable), phone, assignee picker, status (open/snooze/close).
- **Window chip:**
  - `Window open · Xh Ym left`
  - amber under 2 h
  - `Window closed – template only`
  - `No customer message yet – template only`
- "Create order" or "Order MMB-2026-0012 · Quoted · Awaiting customer decision" link.

**Message list:** grouped by day (Africa/Lagos), bubbles left = customer, right = staff.

| Element             | What it shows                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inbound             | Text; media (image thumbnail → lightbox; audio player; video player; document chip with filename + size; location with map link); quoted reply (context)                                                       |
| Classification chip | Label, confidence %, "Needs review" if flagged; menu "Change label" (override)                                                                                                                                 |
| Optional (P2 flags) | Transcript, image description (labelled "AI"), urgency badge                                                                                                                                                   |
| Outbound            | Text/media/template rendering; sender name; status ticks (accepted ◷, sent ✓, delivered ✓✓, read ✓✓ blue, failed ⚠ with the error text from §8.9 mapping); "Delivery uncertain" badge for `needs_manual_check` |
| Media states        | pending ("Downloading…"), stored, failed ("Media unavailable – retrying"), expired ("Media expired (older than 7 days at download time)")                                                                      |

**Composer:**

- _Window open:_ text area (4,096 char counter), attach (image/video/audio/document), reply-to, buttons **Send** (SEND_ROLES) or **Submit for approval** (others), **Save draft**.
- _Window closed / never opened:_ text area disabled with the explanation; **Template picker** (APPROVED templates only; shows the body with `{{n}}` inputs, all required; preview) → Send / Submit.
- _Sending states:_ sending spinner on the bubble → accepted → ticks via webhooks; failure shows a Retry button (if allowed) and the error text.
- **P2 buttons** (visible only if the flag is on): "Suggest reply" (creates a pending draft shown in the composer area with Approve/Edit/Discard), "Extract brief".

**Right sidebar:**

- Contact card (email field for Paystack)
- Order summary (stage, waiting_on, need_by, risk chip, missing-field count)
- Open follow-ups
- Pending drafts for this conversation

**AC-UI-4:** a designer sees "Submit for approval" and not "Send".
**AC-UI-5:** with the window closed, free text is disabled and a template send succeeds against the mock.
**AC-UI-6:** a failed send shows the mapped error text and the Retry button.

### 16.4 Approvals (`/approvals`, SEND_ROLES)

- Table: created at, conversation (name), origin chip (staff/AI suggestion/follow-up/quote/payment link), preview, created by, window status, AI run link (if AI).
- Row actions: **Approve & send**, **Edit then approve**, **Reject (reason)**.
- Disabled "Approve" with the tooltip "Window closed – convert to template" when free-form and the window is closed.
- States: empty ("Nothing waiting for approval").
- Realtime via the `approvals` channel.

**AC-UI-7:** approving moves the message to the thread with status ticks, and the row disappears for all approvers within 5 s.

### 16.5 Orders board (`/orders`, `FF:orders.module`)

- **Kanban:** columns = stages (Lost collapsed).
- Card: ref, customer, items summary ("80 polos"), need_by, risk chip, waiting_on label, owner, missing count.
- Drag-and-drop calls `/transition`. Guard failures show a modal listing the failing guards (e.g. "Missing: size breakdown, delivery method").
- Filters: owner, risk, waiting_on, need_by range.
- Toggle to table view.
- States: empty ("No orders yet – create one from a conversation").

### 16.6 Order detail (`/orders/[id]`)

**Header:** ref, stage + waiting_on, risk chip with reasons, owner, actions (Transition, Mark lost, Create quote).

**Brief tab:**

- Grouped sections: Customer / Items & variants / Sizes / Personalisation / Dates / Delivery / Budget / Notes.
- Each field shows its value, a **status chip** (confirmed green, provisional amber, assumed purple with the rule name, missing red outline), an evidence link (click → opens the thread scrolled to the message, highlighted), and set by AI/staff.
- Inline edit (per role) → becomes `set_by='staff'`.
- Variants grid: colour × cut, qty, sizes sub-grid with a sum check.
- Banner when "Quantities don't add up".

**Other tabs:**

- **Clarifications:** open questions, priority order. "Copy into composer" inserts the selected questions into the thread composer as one message (still needs Send/approval).
- **Changes:** timeline of change events (before → after, evidence, actor, acknowledgements). Post-confirmation changes show **Accept** / **Reject**, and department **Acknowledge** buttons.
- **Quotes:** versions list (status chips incl. superseded); the builder (§16.7).
- **Payments:** payment requests (kind, amount, status, link copy, paid_at, channel); "Create payment link"; "Record manual payment" (admin/manager).

States: loading, not found, forbidden prices (other roles see "—" for money).

**AC-UI-8:** clicking an evidence link opens the thread with that message highlighted.
**AC-UI-9:** for designer/production/dispatch the money fields render "—" and the payments tab is hidden.

### 16.7 Quote builder (modal on order detail)

- Lines are prefilled from active line items: qty (from variants), unit price (auto from `price_rule` with the rule name, or empty "Staff to price"), line total.
- Delivery, discount, valid until; total.
- Buttons: Save draft, **Send quote** (SEND_ROLES; disabled until all lines are priced), Preview message.
- Validation errors are shown inline.

**AC-UI-10:** "Send quote" is disabled while any unit price is empty.

### 16.8 Follow-ups (`/followups`)

- Sections: Overdue / Today / Upcoming.
- Row: customer, order ref, reason, due, last contact, draft preview (text or template).
- Actions: **Open thread**, **Approve & send draft** (SEND_ROLES), Snooze (1 d / 3 d / custom), Done, Dismiss (reason).
- Manual "Add follow-up" from the thread.
- States: empty ("You're all caught up").

### 16.9 Dashboard (`/dashboard`) (manager, admin; sales sees own)

Cards and charts (range 7 d / 30 d; Africa/Lagos days):

1. Inbound messages per day, stacked by class.
2. Conversations needing first response; median and p90 first-response time (first inbound → first outbound) per staff member.
3. Unanswered conversations > 2 h (business hours).
4. Complaints open (no outbound after the last complaint).
5. Orders by stage (count and ₦ quoted value).
6. Quotes awaiting decision (count, ₦, oldest).
7. Payments: ₦ paid in range, outstanding balances.
8. At-risk / late orders list.
9. Overdue follow-ups by owner.
10. WhatsApp cost proxy: delivered outbound by `pricing.category` this month vs the 1,000 free service messages.
11. AI health: classification volume, % needs_review, override rate by class.

States: loading, empty (no data in range).

**AC-UI-11:** the numbers on the dashboard match SQL reference queries in `tests/integration/dashboard.test.ts` for the seeded dataset.

### 16.10 Settings (`/settings/*`)

- **WhatsApp** (`/settings/whatsapp`, admin):
  - Table of every `wa_phone_number` row: label, display number, Phone number ID, lifecycle, `is_active`, verified name / `name_status`, quality rating, messaging tier, `code_verification_status`.
  - **Refresh from Meta:** `GET /{META_GRAPH_API_VERSION}/{META_WABA_ID}/phone_numbers` (follow paging); upsert by `phone_number_id`; set `lifecycle='connected'` when Meta reports connected; never write a PIN. New numbers default to `is_active=false` and `label` editable by admin (`test` / `mmabon` / free-form).
  - **Set as sending number:** allowed only when `lifecycle='connected'`. Sets that row `is_active=true` and all others `is_active=false` in one transaction; writes `audit_log(action='wa_phone_number.activate', before/after)`. This is the day-to-day swap; no deploy.
  - Webhook last-received time; token health (`GET /{phone-number-id}` for the active number); **Send test template to my number**.
  - Banner when more than one `lifecycle='connected'` number exists: _"Replies always go out from the number the customer wrote to. Active = default only for rare paths with no conversation."_
- **Templates** (`/settings/templates`): list with status, category, params; Sync button; last synced.
- **Feature flags** (`/settings/flags`, admin): toggles with descriptions; audit trail per flag.
- **Automation** (`/settings/automation`, admin): each setting off/on with type-to-confirm, config editor, last changed by.
- **Pricing & rules** (`/settings/pricing`, admin/manager): CRUD for `price_rule`, `lead_time_rule`, `default_rule` (enable toggle with warning "Values from this rule will be marked ASSUMED and must be confirmed"), `capacity_day` (weekly grid).
- **Users** (`/settings/users`, admin): invite, change role, deactivate.

### 16.11 Audit log (`/audit`, admin/manager)

- Filterable table: time, actor, action, entity, before/after diff viewer.

### 16.12 AI review (`/ai/review`, admin/manager/sales)

- Queue of messages with `classification_needs_review=true` and no override: one-click confirm or change label (writes an override).
- A "Download labelled set" button writes overrides to a JSONL file (feeds §10.5).

---

## 17. Testing strategy

### 17.1 Layers

| Layer       | Tool                                                                    | Scope                                                                           | Runs                    |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| Unit        | Vitest                                                                  | parsing, window, grounding, pricing, feasibility, transitions, signature verify | every push              |
| Rule tests  | Vitest                                                                  | R-1…R-5 (§2), permissions matrix                                                | every push (blocking)   |
| Contract    | Vitest                                                                  | Meta payload fixtures → rows; Paystack event fixtures                           | every push              |
| Integration | Vitest + local Supabase (`supabase start`) + worker + `apps/mock-graph` | end-to-end through the queue                                                    | every push to main / PR |
| E2E         | Playwright                                                              | UI flows + scenarios A–E                                                        | PR + nightly            |
| Eval        | `pnpm eval:*`                                                           | classification, extraction                                                      | on AI changes + weekly  |
| Load        | k6                                                                      | webhook ingest SLO                                                              | weekly + before go-live |

### 17.2 Fixtures: anonymised sample conversations replayed as webhooks

The team writes sample conversations with MMABON staff. They are based on MMABON's real patterns, with all names and numbers fake.

**Format:** `fixtures/conversations/<id>.yaml`

```yaml
id: A_scattered
contact: { wa_id: "2348000000101", profile_name: "Chidi (Fixture)" }
start: "2026-10-12T09:00:00+01:00"
messages:
  - {
      at: "+0m",
      from: customer,
      type: text,
      text: "polos for staff",
      expect: { class: order },
    }
  - {
      at: "+2m",
      from: customer,
      type: text,
      text: "maybe 80, navy",
      expect: { class: order },
    }
  - {
      at: "+5m",
      from: customer,
      type: text,
      text: "logo, will send",
      expect: { class: order },
    }
  - {
      at: "+9m",
      from: customer,
      type: text,
      text: "mixed sizes mostly L and XL",
      expect: { class: order },
    }
  - {
      at: "+15m",
      from: customer,
      type: text,
      text: "before the 28th?",
      expect: { class: order },
    }
  # staff turns are sent through the real outbound API against apps/mock-graph:
  # - { at: "+20m", from: staff, as: "sales@test", type: text, text: "..." }
expect_brief: eval/extraction/gold/A_scattered.json
```

Media fixtures reference `fixtures/media/*.jpg|.ogg`. The mock Graph server serves them for `GET /{media-id}` and the download URL.

**Required fixture set (minimum):**

- the five scenario conversations (A–E)
- 10 inquiry-only chats
- 6 complaint chats
- 6 spam
- 4 Pidgin-heavy chats
- 3 with captionless images
- 2 voice-note chats (P2)
- 2 payment-related chats

**Replay tool:** `pnpm fixtures:replay --file fixtures/conversations/A_scattered.yaml --target http://localhost:3000 --speed 60` (60× faster than real time; `--speed 0` = no delay).

- It builds Meta-shaped payloads, using the exact structure in §8.4, with `metadata.phone_number_id` = the active `wa_phone_number.phone_number_id` if present, else `META_PHONE_NUMBER_ID`. Optional `--phone-number-id` overrides for multi-number fixtures.
- It sets fresh `wamid`s (`wamid.FIXTURE.<id>.<n>`) and unix timestamps (start time + offsets, rebased to now by default; `--keep-times` keeps them).
- It signs each payload with `META_APP_SECRET` (`X-Hub-Signature-256`) and POSTs to `/api/webhooks/whatsapp`.
- It also emits status webhooks for staff turns via the mock Graph server (`accepted` → POST `sent`, then `delivered` after 1 s, `read` after 3 s; configurable failures with `fail_code: 131047`).

**`apps/mock-graph`** (Fastify, port 4010), implementing:

- `POST /:version/:phoneNumberId/messages` (validates the body shape, returns a wamid, schedules status webhooks)
- `POST /:version/:phoneNumberId/media`
- `GET /:version/:mediaId`
- `GET /media-download/:mediaId`
- `GET /:version/:wabaId/message_templates`

It has fault-injection headers/config for: 5xx, 429, 131047, 131026, 131056, timeout, a 404 on the first media URL, and a sha mismatch.

**AC-TST-1:** `pnpm test:integration` replays all fixtures and asserts message counts, ordering, classification non-null, media stored and outbound statuses.

### 17.3 Extraction evaluation (P2 gate for `FF:ai.extract_brief`)

- **Gold briefs:** `eval/extraction/gold/<fixture>.json` (same shape as the extraction output after post-processing), produced by two people independently and reconciled.
- **Minimum:** 5 scenario fixtures + 15 additional order conversations.
- **Metrics:**

| Metric                                                                              | Definition                                                                 | Target                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| Value accuracy (key fields: product, qty, colours, sizes, need_by, delivery_method) | exact match after normalisation                                            | ≥ 0.85                                         |
| Status accuracy                                                                     | predicted status = gold status                                             | ≥ 0.85                                         |
| **False-confirmed rate**                                                            | predicted `confirmed` where gold ≠ confirmed                               | ≤ 0.01                                         |
| **Fabrication rate**                                                                | non-missing value where gold = missing                                     | **0** on the scenario fixtures; ≤ 0.01 overall |
| Missing-field recall                                                                | gold missing → predicted missing or provisional + clarification            | ≥ 0.90                                         |
| Evidence precision                                                                  | cited messages truly support the value (manual check on a 50-value sample) | ≥ 0.90                                         |
| Change detection recall (fixtures with changes)                                     | gold changes found                                                         | ≥ 0.90                                         |
| Clarification usefulness                                                            | MMABON admin rates 0–2; mean                                               | ≥ 1.5                                          |

- **Runner:** `pnpm eval:extract --model $M --prompt extract-brief-v1.0.0` writes a report like §10.5.

### 17.4 Scenario E2E tests

`e2e/scenarios/{A..E}.spec.ts` replay the fixture, then assert the UI and DB state described in §18. With `FF:ai.extract_brief` off, the scenarios assert P1 behaviour (classification, inbox, manual brief entry). With it on, they assert the full behaviour.

---

## 18. Scenarios A–E (from MMABON's brief)

Each scenario is a fixture (§17.2) and an E2E test (§17.4). "P1" = behaviour with only `ai.classify` on. "P2" = with `ai.extract_brief`, `ai.suggest_reply`, `feasibility.engine` on.

### Scenario A: scattered information across 5 messages → one brief

**Input** (customer, ~15 min apart, conversation starts 12 Oct 2026):
`[m1] polos for staff` · `[m2] maybe 80, navy` · `[m3] logo, will send` · `[m4] mixed sizes mostly L and XL` · `[m5] before the 28th?`

**P1:**

- 5 webhooks → 5 `message` rows in order, each appearing live in the inbox.
- Each is classified **`order`** (m1–m5). The conversation shows under the _Orders_ tab.
- Sales clicks "Create order" → `orders(stage='new_enquiry')` and enters the brief manually, with evidence links picked from the thread.

**P2** (`extract_brief` result after post-processing):

| Field                                                                                       | Value                                     | Status                                            | Evidence | Why                                                            |
| ------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------- | -------- | -------------------------------------------------------------- |
| line item `product_label`                                                                   | "polos" (`product_code: polo`)            | confirmed                                         | m1       | stated                                                         |
| `purpose`                                                                                   | "staff"                                   | confirmed                                         | m1       | stated                                                         |
| variant qty                                                                                 | 80                                        | **provisional**                                   | m2       | hedge "maybe"                                                  |
| variant colour                                                                              | navy                                      | **provisional**                                   | m2       | same hedged sentence                                           |
| `logo_required`                                                                             | true                                      | confirmed                                         | m3       | "logo"                                                         |
| `artwork_status`                                                                            | awaited                                   | confirmed                                         | m3       | "will send"                                                    |
| sizes                                                                                       | L: null, XL: null; other sizes not listed | **provisional** (sizes named), counts **missing** | m4       | "mostly", no numbers                                           |
| `need_by`                                                                                   | 2026-10-28                                | **provisional** (question)                        | m5       | ends with "?" → deadline **to confirm**                        |
| `fabric`, `decoration`, `placement`, `delivery_method`, `delivery_address`, `customer_name` | null                                      | **missing**                                       | (none)   | not given; **no defaults applied** (no enabled `default_rule`) |

- Assumed fields: **0**. The order moves to `awaiting_details` with `waiting_on='customer_details'`.
- Clarifications (priority order): exact quantity → colour confirm → size breakdown → embroidery or print and placement → fabric → firm deadline → delivery/pickup + address → logo file.
- If `ai.suggest_reply` is on: a `pending_approval` draft combining these questions. No prices (none quoted).

**Tests:**

- `A.spec`: the brief chips match the table.
- `r1-no-invented-fabric` passes.
- The `fabrication_rate = 0` assertion passes.
- The draft contains no ₦ amount.

### Scenario B: reference image only, "make something like this for our group, how much for 50?"

**Input:** `[m1] <image, no caption>` then, 20 s later, `[m2] make something like this for our group, how much for 50?`

**P1:**

- m1 stored; media downloaded and shown as a thumbnail.
- m1 classification is delayed 60 s (lookahead) and includes m2 → **`inquiry`**. m2 → **`inquiry`** (asks the price; no product spec beyond quantity).

**P2:**

- `describe_image` (if on) → `media_description` "Crew-neck T-shirt, front chest print, 2 colours" → stored in `notes` only.
- `extract_brief` gives:
  - qty 50: **provisional** (price question, not an order), evidence m2
  - `purpose` "group": confirmed
  - product, fabric, colours, sizes, decoration, need_by: **missing** (the image is a reference only, R-1 #4)
- Clarifications: product type (T-shirt/polo/other), fabric, colours, sizes, print or embroidery, deadline, delivery.
- **Pricing gate:** product and decoration are missing → `priceLineItem` returns `NOT_QUOTABLE`. No `quote` row is created.
  - If `price_rule` rows exist, the sidebar may show an **"Estimate, not a quote"** range for the likely products, visible to staff only.
  - A suggested reply may mention an estimate **only** if staff tick "Include estimate", and the wording must say it's an estimate.
  - With no pricing rules, the suggestion contains no amount at all (validator R-1 #5).

**Tests:** `B.spec`: no quote created; the product status is missing; the draft has no ₦ amount when the rules table is empty.

### Scenario C: 120 reunion shirts: 3 colours, round/V-neck, nicknames, ₦2m, 3 weeks

**Input:** "We need 120 reunion shirts. 40 white, 40 black, 40 wine. Men round neck, ladies V-neck. Some will have nicknames at the back. Budget is N2m. Event is in 3 weeks."

**P1:** classified **`order`**; staff create the order.

**P2** extraction:

- Line item "reunion shirts" (`product_code` null until staff map it to `tshirt_round`/`tshirt_v`). Fabric/decoration/front design: **missing**.
- **Variants:**

  | Colour | Men round neck    | Ladies V-neck     | Colour total   |
  | ------ | ----------------- | ----------------- | -------------- |
  | White  | qty null, missing | qty null, missing | 40 (confirmed) |
  | Black  | qty null, missing | qty null, missing | 40 (confirmed) |
  | Wine   | qty null, missing | qty null, missing | 40 (confirmed) |

  The colour totals are stored on the colour-level variant group. The total of 120 is confirmed and reconciles 40+40+40 (`derivation:'sum'`). The cut split is **missing**. Code never splits the totals (`r1-no-invented-split`).

- **Sizes:** missing (flag "Size breakdown missing").
- **Personalisation:** `required=true` (confirmed); `details_missing = ['which shirts','names list','font/colour','size of print']`.
- `budget`: 200,000,000 kobo (₦2m), confirmed.
- `event_date`: message date + 21 days (provisional; the exact date is missing).
- `need_by`: null/missing. The suggested question is: "Is the event on {date}? When should we deliver?"
- **Feasibility** (flag on):
  - _Budget:_ ₦2m / 120 = ₦16,667 per shirt incl. personalisation. With price rules, e.g. "Estimate ₦17,500–₦19,000 per shirt with back names → ₦2.10m–₦2.28m, over budget". Without rules: "Budget check unavailable – add price rules".
  - _Deadline:_ uses `lead_time_rule` + `capacity_day`. With `need_by` unknown → `risk_level='unknown'`, reason "Exact event date missing". Once the date is confirmed, it computes e.g. "Needs 9 production days + 2 artwork days; 15 working days available → ok/watch".
- Clarifications: men/ladies split per colour; sizes per variant (offer a size-grid message); names list; fabric; front design; exact event date and delivery.
- The suggested reply includes a gentle budget-options line **only** when a computed estimate exists.

**Tests:** `C.spec`: 6 variant cells with qty null + missing; a total of 120 reconciled; flags shown; no invented split.

### Scenario D: "let me discuss with my team" after a quote

**Setup:** order MMB-2026-0142 in stage `quoted`; quote `MMB-Q-0142` v1, ₦1,450,000, `sent` on 9 Oct 2026 (approved outbound, delivered).
**Input** (Sat 10 Oct 2026, 11:40 WAT): `[m] Ok let me discuss with my team`

**P1 + P2:**

- Classified **`order`** (a context-dependent reply to an open quote).
- Order logic (deterministic, no AI): an inbound message in a conversation with a `sent` quote and no acceptance → `waiting_on='customer_decision'`, `last_customer_contact_at = m.wa_timestamp`. The **stage stays `quoted`**. The UI shows "Quoted · Awaiting customer decision", quote ref + version + total, "Last contact: 10 Oct 2026", and "Waiting N days".
- `change_event(kind='note', reason='Customer deferring decision', source_message_id=m)`.
- Follow-up: `followups.generate_due` (P2) or a manual follow-up creates `followup(reason='quote_no_reply', due_at = last contact + 2 working days` = Tue 13 Oct 2026 10:00 WAT; working days are Mon–Sat), with a draft:
  - window open → text: "Good morning 🙏 Just checking in on quote MMB-Q-0142 (₦1,450,000) for your team. Happy to adjust anything. When do you need the shirts?"
  - window closed → template `quote_ready` with params [name, "MMB-Q-0142", "₦1,450,000"]

  Either way it is `pending_approval`.

- **Never confirmed:** no code path moves to `confirmed` without a staff action + acceptance message (§11.1). "Ok" is not acceptance.

**Tests:**

- `D.spec`: stage = quoted, waiting_on = customer_decision, the follow-up exists with due date = +2 working days, outbound pending.
- `orders-ai-cannot-confirm` passes.

### Scenario E: changes during negotiation

**Setup:** order in `quoted`, quote v1 = 150 red polos (₦7,000 each, rule `polo 100–199`) + 50 caps (₦3,000), `need_by` Monday 26 Oct 2026 (confirmed earlier).
**Input** (Thu 22 Oct): `[m1] make it 200` · `[m2] red to wine` · `[m3] remove the caps` · `[m4] still by Monday?`

**P1:** all classified **`order`**. Staff edit manually; the same change log is written by the PATCH endpoints.

**P2:** `extract_brief` returns `changes[]`:

| #   | Op               | Target      | Before → After           | Evidence | is_question |
| --- | ---------------- | ----------- | ------------------------ | -------- | ----------- |
| 1   | set              | polo.qty    | 150 → 200                | m1       | false       |
| 2   | set              | polo.colour | red → wine               | m2       | false       |
| 3   | remove_line_item | caps        | present → removed        | m3       | false       |
| 4   | set              | need_by     | 2026-10-26 → (unchanged) | m4       | **true**    |

- Validation: "the caps" matches exactly one line item. If it were ambiguous → a clarification, not a removal.
- **Apply (pre-confirmation):** changes 1–3 are applied, with `change_event` ×3 (before/after/evidence). The caps line is soft-deleted (undo available). Change 4 doesn't change the value: `need_by.status → provisional` + a feasibility check.
- **Re-price:** rule `polo 200–499` gives ₦6,500 → 200 × ₦6,500 = ₦1,300,000. Caps removed. Quote **v2 `draft`** created; v1 → `superseded` (`change_event quote_created`/`quote_superseded`). Lines without a rule show "Staff to price".
- **Feasibility:** `lead_time_rule` polo + embroidery (e.g. 30/day + 1 setup day) → 200 needs 8 days; working days before Monday = Thu, Fri, Sat → `at_risk`, reason "Needs 8 production days; 3 available before Mon 26 Oct".
- Stage → `negotiating`; `waiting_on='customer_decision'`.
- Suggested reply (pending approval; amounts from quote v2 only): "Noted 🙏 Updated: 200 polos in wine, caps removed. New total ₦1,300,000 (quote MMB-Q-0142 v2). For Monday: 200 pieces won't be ready by then. We can deliver part on Monday and the rest later in the week, or all by {date}. Which works for you?" The `{date}` is computed by the feasibility engine. If the engine is off, the sentence reads "we'll confirm the delivery date shortly".

**Tests:** `E.spec`: 3 applied change events + 1 question; caps `removed_at` set; quote v2 total = 130,000,000 kobo; v1 superseded; risk at_risk; the draft amounts equal the quote v2 values.

---

## 19. Security, privacy, observability, operations

### 19.1 Security

- HTTPS only. HSTS. Strict CSP (no inline scripts except Next's nonce).
- Webhook routes:
  - signature-verified (Meta `X-Hub-Signature-256` with `META_APP_SECRET`; Paystack `x-paystack-signature` HMAC-SHA512 with `PAYSTACK_SECRET_KEY`)
  - body limit 5 MB
  - no auth cookies read
- Tokens live only in server env (R-5). Rotate the Meta system-user token if it leaks, and also whenever a staff member with Meta admin access leaves.
- Rate limiting on `/api/*` (per user 300 req/min; login 10/min/IP) via Upstash-free in-memory LRU on the web instance plus Supabase Auth rate limits. Webhooks are not rate-limited, apart from the invalid-signature logging cap.
- Media is in a private bucket, accessible only through signed URLs (300 s).
- Phone numbers are masked for designer/production/dispatch in the UI (last 4 digits only).
- Dependency audit (`pnpm audit --prod`) in CI. Renovate weekly.

### 19.2 Privacy (Nigeria Data Protection Act 2023)

- MMABON is the data controller; the team/hosting are processors (written agreement, Q-10).
- A privacy notice link is in the WhatsApp business profile (MMABON to add).
- **Data minimisation:**
  - we store only messages sent to the business number
  - LLM provider: an account configured with no training on API data
  - only the necessary message text is sent to the LLM
- **Subject requests:** admin "Download contact data" (JSON of contact, messages, orders) and "Delete contact". Delete = anonymise `contact`, null `text_body`/`caption`/`transcript`, delete media objects, and keep `orders` financial totals for accounting with the contact replaced by `[deleted]`. Both actions are audited.

### 19.3 Retention (`maintenance.purge`, nightly)

| Data                     | Retention                                               |
| ------------------------ | ------------------------------------------------------- |
| `webhook_event.body`     | 30 days (then set `body = '{}'`)                        |
| Invalid-signature events | 7 days                                                  |
| `ai_run.input`           | 90 days (then `{}`); output and metadata kept           |
| `api_idempotency`        | 24 h                                                    |
| Messages, media, orders  | Until MMABON's retention decision (Q-11). Default: keep |

### 19.4 Observability

**Sentry** (web + worker) with release tags. **pino** JSON logs with `requestId`, `webhookEventId`, `jobId`, `conversationId`. No message bodies at `info` level.

**Metrics** (logged + `/api/health` summary):

| Metric                            | Type      |
| --------------------------------- | --------- |
| `webhook_ingest_ms`               | p50/p95   |
| `webhook_invalid_signature_total` | count     |
| `job_lag_seconds` per queue       | gauge     |
| `job_failures_total`              | count     |
| `dlq_size`                        | gauge     |
| `send_failures_total` by code     | count     |
| `classification_latency_ms`       | histogram |
| `needs_review_rate`               | ratio     |

**Alerts** (email to admin + `system.alert` broadcast):

| Alert                    | Condition                                          |
| ------------------------ | -------------------------------------------------- |
| No webhooks              | No webhook received for 6 h during 08:00–20:00 WAT |
| Queue lag                | `wa.process_event` lag > 60 s                      |
| DLQ                      | Any DLQ item                                       |
| Auth errors              | Graph error 190/10/200/131031                      |
| Payment amount mismatch  | Any                                                |
| Template rejected/paused | Any                                                |
| Phone quality            | Quality rating not GREEN                           |

### 19.5 Operations runbook (`docs/runbook.md`, delivered in week 6)

Covers:

- rotating the Meta token / app secret / Paystack keys
- replaying DLQ jobs (`scripts/requeue-dlq.ts`)
- re-processing a `webhook_event` by ID (`scripts/reprocess-event.ts`)
- restoring from a Supabase backup (daily PITR on the Pro plan)
- pausing all sends (`feature_flag` `sends.paused`, checked by `sendOutbound` → throw `SENDS_PAUSED`; seeded `false` in §7)

---

## 20. Six-week timeline (deliverables and acceptance criteria per week)

Week 1 starts at kickoff. "Demoable" means it runs on staging, driven by the fixture replay. Meta setup is **in this spec** (§8.1). Connect the pilot number `+2349079207221` as soon as staging has a public `APP_BASE_URL` (target: end of week 1 / early week 2). Week 4 re-checks live Meta and hardens; cutover to the MMABON number is §23 and is not blocked on a separate guide.

| Week                                 | Deliverables                                                                                                                                                                                                                                                                                                            | Acceptance criteria (all must pass)                                                                                                                                                                                                                                 | Owner (suggested)                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **1: Foundation & ingest**           | Monorepo; CI (lint, typecheck, unit, gitleaks); Supabase local + staging; migrations 0001/0002; auth + invite + roles; `/api/webhooks/whatsapp` GET/POST; `wa.process_event`; `apps/mock-graph`; replay tool; 10 fixtures; **§8.1 Meta portfolio/app/WABA + register `+2349079207221` when a public URL exists**        | AC-WH-1…4, AC-WH-6 (text/image/status payloads), AC-WH-7 on local; R-4 duplicate test; R-5 bundle test; RLS deny test; `pnpm fixtures:replay` of A creates 5 rows; if public URL ready: webhook handshake + one live inbound on the test number                     | Kehinde (backend + Meta), Daniel (auth/UI shell), Stella (fixtures + labelling guide)  |
| **2: Inbox, thread, sending, media** | Inbox + thread UI with realtime; outbound text/media/template via `wa.send_outbound` (per-conversation phone number ID); status handling; window logic + composer states; media download + viewer; templates sync; approvals screen; audit log writes; Settings → WhatsApp number list (refresh / set active)           | AC-UI-2…7; AC-WH-8; AC-WIN-1…3; AC-MED-1…3; R-2 tests (all 7); send uses conversation’s `wa_phone_number`                                                                                                                                                           | Daniel (UI), Kehinde (send/status/media), Stella (QA + 20 more fixtures)               |
| **3: AI classification**             | Pipeline framework + `ai_run`; classify step + prompt v1; flags UI; AI review screen; override flow; eval harness; labelled set ≥ 400 (κ reported); model chosen (Q-12); R-3 test                                                                                                                                       | AC-CLS-1…4; eval report committed; held-out targets met (§10.5) or a documented plan + prompt v1.1 re-run; `ai.classify` enabled on staging                                                                                                                         | Kehinde (pipeline), Stella (labels/eval), Daniel (review UI)                           |
| **4: Hardening + live number**       | Error map (§8.9) incl. ambiguous-timeout handling; retries/DLQ + alerts; dashboard v1 (cards 1–4, 10, 11); settings: WhatsApp health, templates, automation (all off), users; k6 load test; **re-verify live Cloud API on staging then production** (pilot number already connected earlier); security review checklist | AC-WH-5 (load); AC-UI-11 (for the implemented cards); live: a real inbound message from a team phone appears ≤ 5 s; a real reply delivered with ticks; template send outside the window delivered; AC-CLS-5 on prod config                                          | All                                                                                    |
| **5: Orders, quotes, Paystack**      | `orders.module` + `payments.paystack` flags on; create order from conversation; brief editor with statuses + evidence picker; transitions + guards; change log; pricing rules UI + engine; quote builder + send; payment links; Paystack webhook; manual payments; follow-ups (manual list)                             | AC-PRC-1…2; AC-PAY-1…5 (Paystack test mode); AC-UI-8…10; `orders-ai-cannot-confirm`; permission matrix test; scenarios A–E P1 E2E pass                                                                                                                              | Kehinde (Paystack + domain), Daniel (orders UI), Stella (rules data from MMABON + E2E) |
| **6: P2 AI behind flags + handover** | `extract_brief` + grounding validator; `suggest_reply`; feasibility engine; follow-up generator; (optional) transcribe/describe; extraction eval (§17.3); scenario E2E with P2 flags; runbook; demo script; handover README                                                                                             | R-1 tests (all 5) pass; extraction targets met on gold set → enable `ai.extract_brief` on staging (else stays off, documented); scenarios A–E P2 E2E pass with flags on; zero open P1 bugs; runbook reviewed; demo rehearsed end-to-end on staging with live number | All                                                                                    |

**Cut line if behind:** drop in this order: optional transcribe/describe → feasibility engine → suggest_reply → extract_brief. Never drop R-1/R-2 tests, classification, approvals or Paystack verification.

---

## 21. Definition of done (every feature)

1. The code is merged with types passing and lint clean.
2. Unit and contract tests are written. Rule tests are green.
3. The feature's ACs pass in CI (or are demonstrated on staging, for live-Meta ACs) and are recorded in `docs/acceptance/<feature>.md` with screenshots.
4. Audit log entries exist for every state-changing staff action.
5. Errors are mapped to user-readable messages.
6. Loading, empty, error and forbidden states are implemented.
7. No secrets in logs. Sentry is clean of new unhandled errors for 24 h on staging.
8. Docs are updated (this spec, if behaviour changed; README; runbook).

---

## 22. Open questions

This is the only place where undecided items are allowed. Each has an owner and a default to use if it's unresolved by the stated deadline, so work never blocks.

### 22.1 For MMABON's first meeting

| ID   | Question                                                                                                                                                                                                                                                                                                                                                  | Why it matters                                | Default if unanswered by end of week 1                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Q-1  | **Resolved 17 Oct 2026** (remaining: who holds the MMABON SIM/PIN at cutover). Pilot Cloud API number = Kehinde’s `+2349079207221` (`label=test`); later add MMABON’s production number on the **same** WABA and set it active (§8.1, §23). Free any number from personal WhatsApp before registering. WhatsApp Business app coexistence is out of scope. | Cutover (§23)                                 | MMABON owner holds the production SIM and PIN; Kehinde holds the test PIN |
| Q-2  | Is the business CAC-registered? Do the legal name and address match across the CAC certificate, utility bill/bank statement and Facebook Page? Who is the Meta Business portfolio admin?                                                                                                                                                                  | Business verification and limits              | Owner is the admin; we prepare a document checklist                       |
| Q-3  | Price list: products, decoration types, quantity tiers, add-ons (back names, V-neck, rush), delivery fees, discount policy                                                                                                                                                                                                                                | `price_rule` seed; quotes                     | No rules → every quote is priced manually                                 |
| Q-4  | Production capacity and lead times per process (sewing, screen, DTF, embroidery, personalisation); working days; holidays                                                                                                                                                                                                                                 | `lead_time_rule`, `capacity_day`, feasibility | Feasibility engine stays off                                              |
| Q-5  | Approve the wording of the 4 launch templates (§8.11). Any languages besides English (Pidgin/Yoruba/Igbo/Hausa)?                                                                                                                                                                                                                                          | Meta template approval takes days             | English wording as in §8.11                                               |
| Q-6  | Can we ask customers for an email for Paystack receipts? If not, is a synthetic email (`wa<number>@pay.mmabon.ng`) acceptable? (Paystack requires an email to initialise a transaction.)                                                                                                                                                                  | Payment links                                 | Synthetic email; check with Paystack support in week 4                    |
| Q-7  | Deposit policy: % required to start production? Does a deposit count as "paid" for the stage?                                                                                                                                                                                                                                                             | Stage guard §11.1                             | Deposit or full → `paid`; production can start after the deposit          |
| Q-8  | Staff list with roles (admin, sales, designer, production, dispatch, manager). Who approves outbound messages? Business hours?                                                                                                                                                                                                                            | Seeding users; out-of-hours setting           | 1 admin (owner), sales = front desk; hours Mon–Sat 08:00–19:00            |
| Q-9  | Is hosting customer data in the EU (Supabase Frankfurt) acceptable, or must data stay in Nigeria?                                                                                                                                                                                                                                                         | NDPA cross-border transfer                    | EU hosting with a disclosure in the privacy notice                        |
| Q-10 | Who signs the data processing agreement for the pilot?                                                                                                                                                                                                                                                                                                    | NDPA                                          | Owner signs a one-page DPA in week 1                                      |
| Q-11 | How long should messages, media and orders be kept?                                                                                                                                                                                                                                                                                                       | Retention job                                 | Keep indefinitely during the pilot; revisit at week 6                     |
| Q-14 | Which customer details are "must know before quoting"? Any default assumptions MMABON wants (e.g. "standard fit unless stated")?                                                                                                                                                                                                                          | `default_rule`, required fields               | No default rules; required fields as in §11.2                             |
| Q-15 | Expected volume: new chats per day, peak season, typical order size                                                                                                                                                                                                                                                                                       | Capacity planning                             | < 500 inbound messages/day                                                |

### 22.2 Engineering open questions

| ID   | Question                                                                                                                                                                            | Owner   | Resolve by    | Default                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- | ------------------------------------------------------------------------------- |
| Q-12 | Which LLM model(s) for classify/extract/suggest/transcribe? Run the §10.5 eval on ≥ 2 candidates from the chosen provider; pick the cheapest that meets the targets                 | Kehinde | End of week 3 | Cheapest candidate meeting targets; set via env                                 |
| Q-13 | Confirm the current Graph API version in Meta's changelog (spec assumes `v25.0`) and re-verify the webhook field names and error codes in §8 against the official docs in a browser | Kehinde | Week 1        | `v25.0`                                                                         |
| Q-16 | Paystack `authorization_url` lifetime: how long does an initialised checkout link stay valid? If short, add a "Regenerate link" action                                              | Kehinde | Week 5        | Regenerate the link if a customer reports it expired; a new reference each time |
| Q-17 | Vercel vs. Render for `apps/web` if the Vercel body-size or time limits cause webhook issues                                                                                        | Kehinde | Week 4        | Vercel                                                                          |

---

## 23. Meta number cutover (test → MMABON)

Initial setup is §8.1. This section is the runbook for moving from the pilot number to MMABON’s production number **on the same WABA**. No new Meta app, system-user token, webhook, or application deploy is required.

### 23.1 Pilot number

|                             |                                                                     |
| --------------------------- | ------------------------------------------------------------------- |
| **E.164**                   | `+2349079207221`                                                    |
| **`wa_phone_number.label`** | `test`                                                              |
| **Owner of two-step PIN**   | Kehinde (never stored by the app)                                   |
| **When**                    | As soon as staging has a public `APP_BASE_URL` and §8.1 is complete |

### 23.2 Cutover steps

1. **Obtain the MMABON SIM.** Prefer a dedicated number that is **not** on personal WhatsApp. If it is on the WhatsApp Business app and MMABON needs the app to keep working, that is a coexistence path — **out of scope** for this product (see §8.1). Free the number from any consumer WhatsApp account before adding it to Cloud API.
2. **Add and register** the MMABON number on the **same** WABA using §8.1.1 steps 5–7 (own display-name review, own SMS/voice verify, own 6-digit PIN held by MMABON’s owner). Unverified portfolios allow at most **2** numbers — enough for test + MMABON. If a third number is needed later, complete business verification first.
3. In the app: Settings → WhatsApp → **Refresh from Meta** (`GET /{META_WABA_ID}/phone_numbers`). Confirm a new `wa_phone_number` row (`label='mmabon'`, `lifecycle='connected'`).
4. Admin clicks **Set as sending number** on the MMABON row. That sets `is_active=true` on MMABON and `is_active=false` on the test row, and writes `audit_log` (`action='wa_phone_number.activate'`). No env change and no redeploy are required for day-to-day switching. Optionally update `META_PHONE_NUMBER_ID` in hosting to match the new bootstrap default for fresh environments.
5. **Leave `+2349079207221` connected** (`lifecycle='connected'`, `is_active=false`). Inbound to the test number still arrives; replies use that conversation’s phone number ID. Old chats do **not** migrate to the MMABON number.
6. Tell customers / publish the MMABON number. New conversations attach to the MMABON `wa_phone_number` row via webhook `metadata.phone_number_id`.
7. Replace the WABA payment method with MMABON’s card when they take over billing.
8. When the test number is no longer needed: remove or delete it in WhatsApp Manager; set `lifecycle='retired'` in the app; **do not** delete historical conversations or messages.

### 23.3 Business verification (later, optional for pilot)

When MMABON needs higher business-initiated limits or more than two numbers: Security Center document upload; legal name and address must match CAC / utility bill / bank statement / Facebook Page (Q-2). Verification raises messaging limits and the phone-number cap; it is not a gate for §8.1.

### 23.4 Offboarding a developer

Remove the person’s portfolio access; rotate the system-user token; rotate the App Secret; update env; confirm webhook and send still work.

### 23.5 Go-live checks (each number)

- Quality rating GREEN (or known); messaging limit tier recorded on the row
- Inbound from a team phone → dashboard ≤ 5 s
- Staff reply delivered with ticks inside the window
- Template send outside the window delivered
- Token health: `GET /{phone-number-id}` succeeds from Settings → WhatsApp

---

## 24. References (checked 16 Oct 2026)

Meta's official developer pages block automated fetching, so they were cross-checked via the secondary sources below. Implementers must re-read the official pages in a browser (Q-13).

**Meta / WhatsApp Cloud API**

- Official (open in browser): Get started: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Official (open in browser): Cloud API docs: https://developers.facebook.com/docs/whatsapp/cloud-api
- Official (open in browser): Register phone number: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration
- Official (open in browser): Webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- Official (open in browser): Pricing: https://developers.facebook.com/docs/whatsapp/pricing
- Official (open in browser): Messaging limits: https://developers.facebook.com/docs/whatsapp/messaging-limits
- Public FAQ (pricing / service messages from 1 Oct 2026): https://whatsappbusiness.com/resources/faq/
- Webhook handshake + `X-Hub-Signature-256` (HMAC-SHA256 with app secret): https://webhookrelay.com/blog/whatsapp-cloud-api-webhooks/
- Same, with a Next.js route example: https://portpreview.com/articles/whatsapp-cloud-api-webhook-localhost
- Same, signature format details: https://docs.webhook.co/providers/meta
- Media (`GET /{media-id}`, URL valid 5 min, webhook media IDs 7 days, 404 handling): https://whatsapp-docs.kap.so/documentation/whatsapp/business-phone-numbers/media
- Voice notes, 24 h window, templates, webhook retries/duplicates: https://www.learnmind.ai/whatsapp-voice-notes-api
- Webhook delivery (at-least-once, no ordering, retries up to 7 days, payload ≤ 3 MB, status pricing metadata): https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices
- Error codes (131047, 131026, 130472 …): https://ominiflow.com/blog/whatsapp-api-error-codes-troubleshooting
- Throughput, pair rate limit (131056), messaging limit tiers: https://dualhook.com/docs/capacity-quality-limits
- Service-message pricing from 1 Oct 2026 (1,000 free per number per month): https://wabacrm.com/blog/whatsapp-service-message-pricing-october-2026

**Paystack**

- Transaction initialize / verify: https://paystack.com/docs/api/transaction/
- Webhooks (HMAC-SHA512 `x-paystack-signature`, IPs, retries, events): https://paystack.com/docs/payments/webhooks/
- Payment Requests API (alternative; returns `request_code`, email-based invoice delivery): https://paystack.com/docs/api/payment-request/
- Pricing: https://paystack.com/pricing

**Libraries** (versions checked on npm, 16 Oct 2026): next 16.4.2, pg-boss 12.38.0, @supabase/supabase-js 2.118.0, zod 4.6.7, drizzle-orm 0.45.4, openai 7.36.0, vitest 5.0.5, @playwright/test 1.64.1.
