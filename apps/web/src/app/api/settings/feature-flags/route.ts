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
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
