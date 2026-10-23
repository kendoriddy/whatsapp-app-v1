import { eq } from "drizzle-orm";
import { automationSetting, auditLog, featureFlag } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const items = await getDb().select().from(automationSetting);
    return Response.json({ items });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "flags_automation_users");
    const body = (await req.json()) as {
      key?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
    };
    if (!body.key || typeof body.enabled !== "boolean") {
      return jsonError("VALIDATION", "key and enabled required", 400);
    }

    const db = getDb();
    const [before] = await db
      .select()
      .from(automationSetting)
      .where(eq(automationSetting.key, body.key))
      .limit(1);
    if (!before) return jsonError("NOT_FOUND", "Unknown automation setting", 404);

    const [row] = await db
      .update(automationSetting)
      .set({
        enabled: body.enabled,
        ...(body.config ? { config: body.config } : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(automationSetting.key, body.key))
      .returning();

    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "automation_setting.update",
      entityType: "automation_setting",
      entityId: body.key,
      before: { enabled: before.enabled, config: before.config },
      after: { enabled: row!.enabled, config: row!.config },
    });

    // Keep Merlin feature flag in sync with the staff-facing auto-reply toggle.
    if (body.key === "auto_send.merlin_replies") {
      await db
        .update(featureFlag)
        .set({
          enabled: body.enabled,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(featureFlag.key, "ai.merlin_auto_reply"));
    }

    return Response.json(row);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
