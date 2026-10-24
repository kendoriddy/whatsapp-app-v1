"use client";

import { FormEvent, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PRODUCT_NAME } from "@/lib/brand";
import { MarketingShell } from "@/components/landing/MarketingShell";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/inbox";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Login failed");
      }
      router.replace(next.startsWith("/") ? next : "/inbox");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mkt-auth-card">
      <h1>Sign in to {PRODUCT_NAME}</h1>
      <p className="mkt-auth-lead">Staff access for your workspace</p>
      <form onSubmit={onSubmit} className="mkt-form">
        <label className="mkt-field">
          <span>Email</span>
          <input
            className="mkt-input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mkt-field">
          <span>Password</span>
          <input
            className="mkt-input"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="mkt-error">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="landing-btn landing-btn-primary"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mkt-auth-foot">
        New to Relay? <Link href="/signup">Get started</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <MarketingShell variant="compact" mainClassName="mkt-page--auth">
      <Suspense fallback={<p className="mkt-auth-lead">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </MarketingShell>
  );
}
