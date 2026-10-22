import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";
import { waPhoneNumber } from "@mmabon/db";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "whatsapp_numbers");
    const db = getDb();
    const items = await db.select().from(waPhoneNumber).orderBy(desc(waPhoneNumber.createdAt));
    return Response.json({ items });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
