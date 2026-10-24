"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { MarketingShell } from "@/components/landing/MarketingShell";

export default function SignupPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: String(fd.get("businessName") ?? ""),
          email: String(fd.get("email") ?? ""),
          whatsapp: String(fd.get("whatsapp") ?? ""),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Could not start signup");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell variant="compact" mainClassName="mkt-page--auth">
      <div className="mkt-auth-card">
        <h1>Start free</h1>
        <p className="mkt-auth-lead">
          Takes about 5 minutes. Keep your WhatsApp Business number.
        </p>

        {done ? (
          <p className="mkt-success">
            Thanks — we received your request. Check your email for next steps
            to connect WhatsApp and invite your team.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mkt-form">
            <label className="mkt-field">
              <span>Business name</span>
              <input
                className="mkt-input"
                name="businessName"
                required
                autoComplete="organization"
              />
            </label>
            <label className="mkt-field">
              <span>Work email</span>
              <input
                className="mkt-input"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </label>
            <label className="mkt-field">
              <span>WhatsApp Business number</span>
              <input
                className="mkt-input"
                name="whatsapp"
                required
                placeholder="+234…"
                autoComplete="tel"
              />
            </label>
            {error && <p className="mkt-error">{error}</p>}
            <button
              type="submit"
              className="landing-btn landing-btn-primary"
              disabled={busy}
            >
              {busy ? "Submitting…" : "Start free"}
            </button>
          </form>
        )}

        <p className="mkt-auth-foot">
          Already on a team? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </MarketingShell>
  );
}
