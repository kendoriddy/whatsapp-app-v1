"use client";

import Link from "next/link";
import { DM_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { PRODUCT_TAGLINE } from "@/lib/brand";
import { MarketingNav } from "./MarketingNav";
import { MarketingFooter } from "./MarketingFooter";
import { RelayLogo } from "./RelayLogo";
import "@/app/landing.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--landing-font",
});

type Props = {
  children: ReactNode;
  /** Full nav + footer (legal pages). Compact = logo + mini footer (auth / pay). */
  variant?: "full" | "compact";
  /** Extra class on main (e.g. mkt-page--auth, mkt-page--legal) */
  mainClassName?: string;
};

export function MarketingShell({
  children,
  variant = "full",
  mainClassName = "",
}: Props) {
  return (
    <div className={`landing ${dmSans.variable} ${dmSans.className}`}>
      {variant === "full" ? (
        <MarketingNav />
      ) : (
        <header className="mkt-compact-top">
          <RelayLogo />
          <p className="mkt-compact-tag">{PRODUCT_TAGLINE}</p>
        </header>
      )}
      <main className={`mkt-page ${mainClassName}`.trim()}>{children}</main>
      {variant === "full" ? (
        <MarketingFooter />
      ) : (
        <footer className="mkt-compact-foot">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/login">Log In</Link>
          <Link href="/signup">Get started</Link>
        </footer>
      )}
    </div>
  );
}
