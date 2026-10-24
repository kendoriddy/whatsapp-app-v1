"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CONTACT_EMAIL } from "@/lib/brand";
import { RelayLogo } from "./RelayLogo";

const featureLinks = [
  { href: "/#inbox", label: "Shared inbox" },
  { href: "/#merlin", label: "Merlin" },
  { href: "/#orders", label: "Orders & invoices" },
  { href: "/#paystack", label: "Paystack payments" },
] as const;

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) {
        setFeaturesOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function closeMobile() {
    setMobileOpen(false);
    setFeaturesOpen(false);
  }

  return (
    <header className={`mkt-nav${scrolled ? " scrolled" : ""}`}>
      <div className="mkt-nav-inner">
        <RelayLogo />

        <nav className="mkt-nav-center" aria-label="Primary">
          <div className={`mkt-dd${featuresOpen ? " open" : ""}`} ref={ddRef}>
            <button
              type="button"
              className="mkt-nav-dd-btn"
              aria-expanded={featuresOpen}
              aria-haspopup="true"
              onClick={() => setFeaturesOpen((v) => !v)}
            >
              Features ▾
            </button>
            <div className="mkt-dd-menu" role="menu">
              {featureLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  onClick={() => setFeaturesOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <a href="/#plans">Pricing</a>
          <a href="/#merlin">How it works</a>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mkt-nav-ext"
            target="_blank"
            rel="noopener noreferrer"
          >
            Help
          </a>
        </nav>

        <div className="mkt-nav-actions">
          <Link href="/login" className="landing-btn landing-btn-outline">
            Log In ›
          </Link>
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Get started ↓
          </Link>
          <button
            type="button"
            className="mkt-menu-toggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      <div className={`mkt-mobile${mobileOpen ? " open" : ""}`}>
        {featureLinks.map((l) => (
          <a key={l.href} href={l.href} onClick={closeMobile}>
            {l.label}
          </a>
        ))}
        <a href="/#plans" onClick={closeMobile}>
          Pricing
        </a>
        <a href="/#merlin" onClick={closeMobile}>
          How it works
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`} onClick={closeMobile}>
          Help ↗
        </a>
        <Link href="/login" onClick={closeMobile}>
          Log In ›
        </Link>
        <Link href="/signup" onClick={closeMobile}>
          Get started ↓
        </Link>
      </div>
    </header>
  );
}
