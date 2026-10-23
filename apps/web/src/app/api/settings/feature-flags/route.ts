import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";
import { featureFlag } from "@mmabon/db";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const items = await getDb().select().from(featureFlag);
    return Response.json({ items });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const body = (await req.json()) as { key?: string; enabled?: boolean };
    if (!body.key || typeof body.enabled !== "boolean") {
      return jsonError("VALIDATION", "key and enabled required", 400);
    }
    const db = getDb();
    const [row] = await db
      .update(featureFlag)
      .set({ enabled: body.enabled, updatedAt: new Date() })
      .where(eq(featureFlag.key, body.key))
      .returning();
    if (!row) return jsonError("NOT_FOUND", "Unknown flag", 404);
    return Response.json(row);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
