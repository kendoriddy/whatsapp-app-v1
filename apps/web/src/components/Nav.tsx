"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav className="nav">
      <div className="brand">MMABON Desk</div>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
