"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WORKSPACE_NAME } from "@/lib/brand";

const links = [
  { href: "/inbox", label: "Inbox" },
  { href: "/approvals", label: "Approvals" },
  { href: "/orders", label: "Orders" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ai/review", label: "AI review" },
  { href: "/settings", label: "Settings" },
  { href: "/audit", label: "Audit" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Public marketing / legal / auth — no desk chrome
  if (
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/pay")
  ) {
    return null;
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <nav className={open ? "nav nav-open" : "nav"}>
      <div className="nav-bar">
        <div className="brand">
          <span className="brand-workspace">{WORKSPACE_NAME}</span>
        </div>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="app-nav-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>
      {open && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div id="app-nav-menu" className="nav-links">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={path.startsWith(l.href) ? "active" : ""}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
        <button
          type="button"
          className="nav-signout"
          onClick={signOut}
          disabled={busy}
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </nav>
  );
}
