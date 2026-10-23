import { desc, eq } from "drizzle-orm";
import { auditLog, staffUser } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "audit");
    const db = getDb();
    const rows = await db
      .select({
        id: auditLog.id,
        at: auditLog.at,
        actorKind: auditLog.actorKind,
        actorId: auditLog.actorId,
        actorName: staffUser.fullName,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        before: auditLog.before,
        after: auditLog.after,
      })
      .from(auditLog)
      .leftJoin(staffUser, eq(auditLog.actorId, staffUser.id))
      .orderBy(desc(auditLog.at))
      .limit(100);

    return Response.json({ items: rows });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
