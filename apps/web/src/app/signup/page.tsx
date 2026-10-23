"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

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
    <div className="login-shell">
      <Link
        href="/"
        className="brand"
        style={{ marginBottom: "0.35rem", display: "inline-block" }}
      >
        {PRODUCT_NAME}
      </Link>
      <p
        className="muted"
        style={{ marginBottom: "1.25rem", maxWidth: "22rem" }}
      >
        {PRODUCT_TAGLINE}
      </p>

      <div className="login-panel panel">
        <h1>Start free</h1>
        <p className="muted">
          Takes about 5 minutes. Keep your WhatsApp Business number.
        </p>

        {done ? (
          <p style={{ marginTop: "1.25rem", lineHeight: 1.5 }}>
            Thanks — we received your request. Check your email for next steps
            to connect WhatsApp and invite your team.
          </p>
        ) : (
          <form
            onSubmit={onSubmit}
            style={{ display: "grid", gap: "0.85rem", marginTop: "1.25rem" }}
          >
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="muted">Business name</span>
              <input
                name="businessName"
                required
                autoComplete="organization"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="muted">Work email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span className="muted">WhatsApp Business number</span>
              <input
                name="whatsapp"
                required
                placeholder="+234…"
                autoComplete="tel"
                style={inputStyle}
              />
            </label>
            {error && (
              <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
            )}
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Submitting…" : "Start free"}
            </button>
          </form>
        )}

        <p
          className="muted"
          style={{ marginTop: "1.25rem", fontSize: "0.9rem" }}
        >
          Already on a team?{" "}
          <Link href="/login" style={{ color: "var(--accent-2)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "0.65rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--panel-2)",
} as const;
