import type { AppRole } from "@mmabon/domain";
import { can, type Capability } from "@mmabon/domain";
import { eq } from "drizzle-orm";
import { staffUser } from "@mmabon/db";
import { getDb } from "./db";
import { getEnv } from "./env";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

/** Dev/local session via headers when Supabase auth is not wired. */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const env = getEnv();
  const devUser = req.headers.get("x-dev-user-id");
  if (env.APP_ENV === "local" && devUser) {
    const db = getDb();
    const [u] = await db.select().from(staffUser).where(eq(staffUser.id, devUser)).limit(1);
    if (u?.active) {
      return {
        id: u.id,
        email: "dev@local",
        fullName: u.fullName,
        role: u.role,
      };
    }
  }

  // Cookie-based Supabase SSR would go here; for local bootstrap allow DEMO_ADMIN_ID
  const demo = process.env.DEMO_ADMIN_ID;
  if (env.APP_ENV === "local" && demo) {
    const db = getDb();
    const [u] = await db.select().from(staffUser).where(eq(staffUser.id, demo)).limit(1);
    if (u?.active) {
      return { id: u.id, email: "admin@local", fullName: u.fullName, role: u.role };
    }
  }
  return null;
}

export async function requireRole(req: Request, roles?: AppRole[]): Promise<SessionUser> {
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
