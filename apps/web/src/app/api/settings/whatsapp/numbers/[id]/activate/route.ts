import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";
import { waPhoneNumber, auditLog } from "@mmabon/db";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(req);
    assertCan(user, "whatsapp_numbers");
    const { id } = await ctx.params;
    const db = getDb();
    const [row] = await db.select().from(waPhoneNumber).where(eq(waPhoneNumber.id, id)).limit(1);
    if (!row) return jsonError("NOT_FOUND", "Number not found", 404);
    if (row.lifecycle !== "connected") return jsonError("CONFLICT", "Number not connected", 409);

    await db.execute(sql`update wa_phone_number set is_active = false where is_active = true`);
    await db.update(waPhoneNumber).set({ isActive: true }).where(eq(waPhoneNumber.id, id));
    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "wa_phone_number.activate",
      entityType: "wa_phone_number",
      entityId: id,
      after: { phoneNumberId: row.phoneNumberId, label: row.label },
    });
    return Response.json({ ok: true, id });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
