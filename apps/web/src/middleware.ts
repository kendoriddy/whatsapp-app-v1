import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PREFIXES = [
  "/login",
  "/privacy",
  "/terms",
  "/pay/thanks",
  "/api/webhooks/",
  "/api/health",
  "/api/auth/",
];

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (isPublic(pathname) || pathname.startsWith("/api/")) {
    return response;
  }

  // Local keeps the DEMO_ADMIN / x-dev-user-id bootstrap without forcing /login
  if (process.env.APP_ENV === "local") {
    return response;
  }

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    // Preserve refreshed cookies from updateSession
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
