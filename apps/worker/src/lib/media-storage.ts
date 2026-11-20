import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "@mmabon/shared";

function serviceClient() {
  const env = loadEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bucket() {
  return loadEnv().STORAGE_BUCKET_MEDIA;
}

export async function uploadMediaFile(args: {
  storagePath: string;
  mime: string;
  bytes: Buffer | Uint8Array;
}): Promise<void> {
  const client = serviceClient();
  const { error } = await client.storage.from(bucket()).upload(args.storagePath, args.bytes, {
    contentType: args.mime || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Media storage upload failed: ${error.message}`);
}
