#!/usr/bin/env tsx
import { loadLocalEnv } from "./load-env.ts";
import postgres from "postgres";

loadLocalEnv();

const email =
  process.argv.find((a) => a.startsWith("--email="))?.slice(8) ?? "admin@mmabon.local";
const name = process.argv.find((a) => a.startsWith("--name="))?.slice(7) ?? "Admin";
const password =
  process.argv.find((a) => a.startsWith("--password="))?.slice(11) ?? "mmabon-local-admin";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("DATABASE_URL required (set in .env.local)");
if (!supabaseUrl || !serviceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
}

const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  }),
});

const body = (await res.json()) as { id?: string; msg?: string; message?: string; email?: string };
if (!res.ok || !body.id) {
  // If user already exists, look them up
  const list = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const listed = (await list.json()) as { users?: Array<{ id: string; email?: string }> };
  const existing = listed.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    throw new Error(body.msg ?? body.message ?? `Failed to create auth user: ${res.status}`);
  }
  body.id = existing.id;
}

const id = body.id!;
const sql = postgres(url, { max: 1 });
await sql`
  insert into staff_user (id, full_name, role, active)
  values (${id}, ${name}, 'admin', true)
  on conflict (id) do update set full_name = excluded.full_name, role = 'admin', active = true
`;

const phoneId = process.env.META_PHONE_NUMBER_ID ?? "local-phone-number-id";
const waba = process.env.META_WABA_ID ?? "local-waba-id";
await sql`
  insert into wa_phone_number (phone_number_id, display_phone_number, waba_id, label, lifecycle, is_active)
  values (${phoneId}, '+2349079207221', ${waba}, 'test', 'connected', true)
  on conflict (phone_number_id) do nothing
`;

console.log(
  JSON.stringify(
    {
      id,
      email,
      name,
      password,
      tip: `Add DEMO_ADMIN_ID=${id} to .env.local, or localStorage.setItem('mmabon_dev_user_id','${id}')`,
    },
    null,
    2,
  ),
);
await sql.end();
