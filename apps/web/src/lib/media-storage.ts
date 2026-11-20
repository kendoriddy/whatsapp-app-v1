import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

function serviceClient() {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bucket() {
  return getEnv().STORAGE_BUCKET_MEDIA;
}

/** Signed URL for private wa-media objects (default 300s). */
export async function createMediaSignedUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const client = serviceClient();
  const { data, error } = await client.storage
    .from(bucket())
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Media signed URL failed: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
