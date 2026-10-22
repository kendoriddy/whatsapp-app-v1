import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

export function createBrowserSupabase() {
  const env = getEnv();
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}
