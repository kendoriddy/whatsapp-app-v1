"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Num = {
  id: string;
  label: string;
  displayPhoneNumber: string;
  phoneNumberId: string;
  lifecycle: string;
  isActive: boolean;
  qualityRating: string | null;
};

export default function WhatsAppSettingsPage() {
  const [items, setItems] = useState<Num[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => api<{ items: Num[] }>("/api/settings/whatsapp/numbers").then((r) => setItems(r.items));
  useEffect(() => {
    void load().catch((e) => setMsg(String(e.message)));
  }, []);

  return (
    <div>
      <h1>WhatsApp numbers</h1>
      <p className="muted">
        Replies always go out from the number the customer wrote to. Active = default only for rare paths with no
        conversation.
      </p>
      <div style={{ display: "flex", gap: 8, margin: "1rem 0" }}>
        <button
          className="btn secondary"
          onClick={() =>
            void api("/api/settings/whatsapp/numbers/refresh", { method: "POST" })
              .then(() => load())
              .then(() => setMsg("Refreshed from Meta"))
              .catch((e) => setMsg(String(e.message)))
          }
        >
          Refresh from Meta
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Number</th>
              <th>Lifecycle</th>
              <th>Active</th>
              <th>Quality</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id}>
                <td>{n.label}</td>
                <td>{n.displayPhoneNumber}</td>
                <td>{n.lifecycle}</td>
                <td>{n.isActive ? "yes" : "no"}</td>
                <td>{n.qualityRating ?? "—"}</td>
                <td>
                  {!n.isActive && n.lifecycle === "connected" && (
                    <button
                      className="btn"
                      onClick={() =>
                        void api(`/api/settings/whatsapp/numbers/${n.id}/activate`, { method: "POST" })
                          .then(() => load())
                          .then(() => setMsg(`Activated ${n.label}`))
                      }
                    >
                      Set as sending number
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
