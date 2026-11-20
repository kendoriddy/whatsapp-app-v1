import { eq } from "drizzle-orm";
import { mediaAsset } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, jsonError } from "@/lib/auth";
import { createMediaSignedUrl } from "@/lib/media-storage";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req);
    const { id } = await ctx.params;
    const db = getDb();
    const [row] = await db
      .select()
      .from(mediaAsset)
      .where(eq(mediaAsset.id, id))
      .limit(1);

    if (!row) {
      return jsonError("NOT_FOUND", "Media not found", 404);
    }
    if (row.status !== "stored" || !row.storagePath) {
      return jsonError("MEDIA_UNAVAILABLE", "Media unavailable", 409);
    }

    const signedUrl = await createMediaSignedUrl(row.storagePath, 300);
    return Response.redirect(signedUrl, 302);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
