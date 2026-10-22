import { z } from "zod";
import { eq } from "drizzle-orm";
import { staffUser } from "@mmabon/db";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { jsonError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(
      "VALIDATION",
      "Email and password (min 8 chars) required",
      400,
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return jsonError(
      "UNAUTHORIZED",
      error?.message ?? "Invalid email or password",
      401,
    );
  }

  const db = getDb();
  const [staff] = await db
    .select()
    .from(staffUser)
    .where(eq(staffUser.id, data.user.id))
    .limit(1);

  if (!staff?.active) {
    await supabase.auth.signOut();
    return jsonError("FORBIDDEN", "No active staff account for this user", 403);
  }

  return Response.json({
    ok: true,
    user: {
      id: staff.id,
      fullName: staff.fullName,
      role: staff.role,
      email: data.user.email,
    },
  });
}
