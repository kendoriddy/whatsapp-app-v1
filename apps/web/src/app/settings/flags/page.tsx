"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Flag = { key: string; enabled: boolean; description: string };

export default function FlagsPage() {
  const [items, setItems] = useState<Flag[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api<{ items: Flag[] }>("/api/settings/feature-flags")
      .then((r) => setItems(r.items))
      .catch((e) => setError(String(e.message)));

  useEffect(() => {
    void load();
  }, []);

  async function toggle(key: string, enabled: boolean) {
    setBusy(key);
    setError(null);
    try {
      await api("/api/settings/feature-flags", {
        method: "PATCH",
        body: JSON.stringify({ key, enabled }),
      });
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1>Feature flags</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="panel" style={{ marginTop: "1rem" }}>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Enabled</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.key}>
                <td>
                  <code>{f.key}</code>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy === f.key}
                    onClick={() => void toggle(f.key, !f.enabled)}
                  >
                    {busy === f.key ? "…" : f.enabled ? "on" : "off"}
                  </button>
                </td>
                <td className="muted">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
