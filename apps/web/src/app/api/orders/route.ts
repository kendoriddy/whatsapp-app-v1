import { desc, eq } from "drizzle-orm";
import { orders, conversation, featureFlag } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";
import { nextOrderRef } from "@mmabon/domain";

export async function GET(req: Request) {
  try {
    await requireRole(req);
    const items = await getDb().select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
    return Response.json({ items, nextCursor: null });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "orders_edit");
    const db = getDb();
    const [flag] = await db.select().from(featureFlag).where(eq(featureFlag.key, "orders.module")).limit(1);
    if (!flag?.enabled) return jsonError("CONFLICT", "orders.module flag is off", 409);

    const body = (await req.json()) as { conversationId: string };
    const [conv] = await db.select().from(conversation).where(eq(conversation.id, body.conversationId)).limit(1);
    if (!conv) return jsonError("NOT_FOUND", "Conversation not found", 404);

    const year = new Date().getFullYear();
    const count = await db.select().from(orders);
    const ref = nextOrderRef(year, count.length + 1);
    const [row] = await db
      .insert(orders)
      .values({
        ref,
        contactId: conv.contactId,
        conversationId: conv.id,
        ownerId: user.id,
        stage: "new_enquiry",
      })
      .returning();
    return Response.json(row);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
