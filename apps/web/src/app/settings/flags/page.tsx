"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Flag = { key: string; enabled: boolean; description: string };

export default function FlagsPage() {
  const [items, setItems] = useState<Flag[]>([]);
  useEffect(() => {
    api<{ items: Flag[] }>("/api/settings/feature-flags")
      .then((r) => setItems(r.items))
      .catch(console.error);
  }, []);
  return (
    <div>
      <h1>Feature flags</h1>
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
                <td>{f.enabled ? "on" : "off"}</td>
                <td className="muted">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
