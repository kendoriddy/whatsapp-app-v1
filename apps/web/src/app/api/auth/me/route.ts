import { getSessionUser, jsonError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return jsonError("UNAUTHORIZED", "UNAUTHORIZED", 401);
  return Response.json({ user });
}
