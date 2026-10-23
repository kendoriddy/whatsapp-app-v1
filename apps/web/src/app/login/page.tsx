"use client";

import { FormEvent, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

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
    <div className="login-panel panel">
      <h1>Sign in to {PRODUCT_NAME}</h1>
      <p className="muted">Staff access for your workspace</p>
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gap: "0.85rem", marginTop: "1.25rem" }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span className="muted">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "0.65rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--panel-2)",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span className="muted">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "0.65rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--panel-2)",
            }}
          />
        </label>
        {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: "0.25rem",
            padding: "0.7rem 1rem",
            borderRadius: 8,
            border: "none",
            background: "var(--accent)",
            color: "#04140c",
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
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
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
