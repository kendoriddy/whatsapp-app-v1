import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

function serviceClient() {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bucket() {
  return getEnv().STORAGE_BUCKET_KNOWLEDGE;
}

export async function uploadKnowledgeFile(args: {
  docId: string;
  filename: string;
  mime: string;
  bytes: Buffer | Uint8Array;
}): Promise<string> {
  const safeName = args.filename.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${args.docId}/${safeName}`;
  const client = serviceClient();
  const { error } = await client.storage.from(bucket()).upload(path, args.bytes, {
    contentType: args.mime || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function downloadKnowledgeFile(
  storagePath: string,
): Promise<{ bytes: Blob; contentType: string }> {
  const client = serviceClient();
  const { data, error } = await client.storage.from(bucket()).download(storagePath);
  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message ?? "not found"}`);
  }
  return { bytes: data, contentType: data.type || "application/octet-stream" };
}

export async function deleteKnowledgeFile(
  storagePath: string | null | undefined,
): Promise<void> {
  if (!storagePath) return;
  const client = serviceClient();
  const { error } = await client.storage.from(bucket()).remove([storagePath]);
  if (error) {
    console.warn("[knowledge] storage delete failed", error.message);
  }
}
