# MMABON Order Desk

WhatsApp Cloud API inbox, AI classification, orders, and Paystack payments for MMABON Custom & Retail.

**Source of truth:** [`spec-v2.md`](./spec-v2.md)

## Stack

- Next.js 16 (`apps/web`) + Node worker (`apps/worker`) + mock Graph API (`apps/mock-graph`)
- Supabase Postgres, pg-boss, Drizzle, Zod, Vitest

## Quick start (local)

```bash
cp .env.example .env.local
pnpm install

# Start local Postgres (requires Docker + supabase CLI)
supabase start
# DATABASE_URL in .env.example already points at supabase local :54322

pnpm db:migrate
pnpm create-admin --email=you@example.com --name=Kehinde
# paste DEMO_ADMIN_ID=<id> into .env.local from the script output

# separate terminals:
pnpm dev:mock-graph   # :4010
pnpm dev:worker
pnpm dev:web          # :3000
```

Scripts load `.env.local` automatically (then `.env`).

In the browser console (or localStorage): `localStorage.setItem('mmabon_dev_user_id', '<admin-uuid>')`

Replay a fixture:

```bash
pnpm fixtures:replay --file fixtures/conversations/A_scattered.yaml --target http://localhost:3000
```

## Tests

```bash
pnpm test
pnpm eval:classify --ci
pnpm eval:extract
```

## Meta phone numbers

Pilot: `+2349079207221`. Setup and cutover to MMABON: **spec §8.1 and §23**. App swap: Settings → WhatsApp (no redeploy).

## Packages

| Package            | Role                                           |
| ------------------ | ---------------------------------------------- |
| `@mmabon/shared`   | env, logger, money, window helpers             |
| `@mmabon/db`       | schema + migrations                            |
| `@mmabon/queue`    | pg-boss jobs                                   |
| `@mmabon/whatsapp` | webhook, signature, `sendOutbound` (R-2)       |
| `@mmabon/paystack` | payments                                       |
| `@mmabon/ai`       | classify / extract / suggest + grounding (R-1) |
| `@mmabon/domain`   | permissions, orders, pricing, feasibility      |
