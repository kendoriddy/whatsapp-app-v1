import type { AppRole } from "@mmabon/domain";
import { can, type Capability } from "@mmabon/domain";
import { eq } from "drizzle-orm";
import { staffUser } from "@mmabon/db";
import { getDb } from "./db";
import { getEnv } from "./env";
import { createServerSupabase } from "./supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

async function staffFromId(
  id: string,
  emailFallback: string,
): Promise<SessionUser | null> {
  const db = getDb();
  const [u] = await db
    .select()
    .from(staffUser)
    .where(eq(staffUser.id, id))
    .limit(1);
  if (!u?.active) return null;
  return {
    id: u.id,
    email: emailFallback,
    fullName: u.fullName,
    role: u.role,
  };
}

/** Session: Supabase cookie (staging/prod), or local DEMO_ADMIN / x-dev-user-id. */
export async function getSessionUser(
  req: Request,
): Promise<SessionUser | null> {
  const env = getEnv();

  // Prefer real Supabase session when cookies are present (all environments)
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return staffFromId(user.id, user.email ?? "staff@mmabon");
    }
  } catch {
    // Env / cookies unavailable — fall through to local bootstrap
  }

  if (env.APP_ENV === "local") {
    const devUser = req.headers.get("x-dev-user-id");
    if (devUser) {
      const fromHeader = await staffFromId(devUser, "dev@local");
      if (fromHeader) return fromHeader;
    }

    const demo = process.env.DEMO_ADMIN_ID;
    if (demo) {
      const fromDemo = await staffFromId(demo, "admin@local");
      if (fromDemo) return fromDemo;
    }
  }

  return null;
}

export async function requireRole(
  req: Request,
  roles?: AppRole[],
): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) {
    const err = new Error("UNAUTHORIZED");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (roles && !roles.includes(user.role)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export function assertCan(user: SessionUser, capability: Capability): void {
  if (!can(user.role, capability)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export function jsonError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}
