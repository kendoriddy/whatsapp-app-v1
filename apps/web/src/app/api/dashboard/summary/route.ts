import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "dashboard");
    const db = getDb();
    const [openConv] = await db.execute<{ c: number }>(sql`select count(*)::int as c from conversation where status = 'open'`);
    const [inbound] = await db.execute<{ c: number }>(sql`select count(*)::int as c from message where direction = 'inbound' and received_at > now() - interval '7 days'`);
    const [pending] = await db.execute<{ c: number }>(sql`select count(*)::int as c from outbound_message where status = 'pending_approval'`);
    const [needsReview] = await db.execute<{ c: number }>(sql`select count(*)::int as c from message where classification_needs_review = true and classification_override is null`);
    return Response.json({
      open_conversations: Number((openConv as unknown as { c: number })?.c ?? 0),
      inbound_7d: Number((inbound as unknown as { c: number })?.c ?? 0),
      pending_approvals: Number((pending as unknown as { c: number })?.c ?? 0),
      classification_needs_review: Number((needsReview as unknown as { c: number })?.c ?? 0),
      pricing_category_counts: {},
      free_service_messages_remaining_estimate: 1000,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
