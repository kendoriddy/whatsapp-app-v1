import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { requireRole, assertCan, jsonError } from "@/lib/auth";
import { waPhoneNumber, auditLog } from "@mmabon/db";
import { createGraphClient } from "@mmabon/whatsapp";

export async function POST(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "whatsapp_numbers");
    const env = getEnv();
    const client = createGraphClient({
      baseUrl: env.META_GRAPH_API_BASE_URL,
      version: env.META_GRAPH_API_VERSION,
      token: env.META_SYSTEM_USER_TOKEN,
    });
    const res = await client.listPhoneNumbers(env.META_WABA_ID);
    const db = getDb();
    for (const p of res.data ?? []) {
      const phoneNumberId = String(p.id);
      const display = String(p.display_phone_number ?? phoneNumberId);
      const existing = await db.select().from(waPhoneNumber).where(eq(waPhoneNumber.phoneNumberId, phoneNumberId)).limit(1);
      if (existing[0]) {
        await db
          .update(waPhoneNumber)
          .set({
            displayPhoneNumber: display.startsWith("+") ? display : `+${display.replace(/\D/g, "")}`,
            verifiedName: p.verified_name ? String(p.verified_name) : null,
            qualityRating: p.quality_rating ? String(p.quality_rating) : null,
            codeVerificationStatus: p.code_verification_status ? String(p.code_verification_status) : null,
            lifecycle: "connected",
          })
          .where(eq(waPhoneNumber.id, existing[0].id));
      } else {
        await db.insert(waPhoneNumber).values({
          phoneNumberId,
          displayPhoneNumber: display.startsWith("+") ? display : `+${display.replace(/\D/g, "")}`,
          wabaId: env.META_WABA_ID,
          label: display,
          lifecycle: "connected",
          isActive: false,
          verifiedName: p.verified_name ? String(p.verified_name) : null,
          qualityRating: p.quality_rating ? String(p.quality_rating) : null,
        });
      }
    }
    await db.insert(auditLog).values({
      actorKind: "staff",
      actorId: user.id,
      action: "wa_phone_number.refresh",
      entityType: "wa_phone_number",
      entityId: "all",
      after: { count: res.data?.length ?? 0 },
    });
    const items = await db.select().from(waPhoneNumber);
    return Response.json({ items });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
