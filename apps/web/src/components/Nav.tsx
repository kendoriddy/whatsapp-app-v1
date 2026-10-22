"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/inbox", label: "Inbox" },
  { href: "/approvals", label: "Approvals" },
  { href: "/orders", label: "Orders" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ai/review", label: "AI review" },
  { href: "/settings/whatsapp", label: "Settings" },
  { href: "/audit", label: "Audit" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (
    path.startsWith("/login") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms")
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
    <nav className="nav">
      <div className="brand">MMABON Desk</div>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={path.startsWith(l.href) ? "active" : ""}
        >
          {l.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        style={{
          marginTop: "auto",
          padding: "0.55rem 0.75rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--muted)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </nav>
  );
}
