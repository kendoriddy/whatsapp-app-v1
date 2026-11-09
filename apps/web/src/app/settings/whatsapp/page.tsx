"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { TableSkeleton } from "@/components/loading/LoadingState";

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
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    api<{ items: Num[] }>("/api/settings/whatsapp/numbers")
      .then((r) => setItems(r.items))
      .finally(() => setLoaded(true));

  useEffect(() => {
    void load().catch((e) => setMsg(String(e.message)));
  }, []);

  return (
    <div>
      <h1>WhatsApp numbers</h1>
      <p className="muted">
        Replies always go out from the number the customer wrote to. Active =
        default only for rare paths with no conversation.
      </p>
      <div className="invoice-form-actions" style={{ margin: "1rem 0" }}>
        <button
          className="btn secondary"
          onClick={() =>
            void api("/api/settings/whatsapp/numbers/refresh", {
              method: "POST",
            })
              .then(() => load())
              .then(() => setMsg("Refreshed from Meta"))
              .catch((e) => setMsg(String(e.message)))
          }
        >
          Refresh from Meta
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Number</th>
              <th className="col-secondary">Lifecycle</th>
              <th>Active</th>
              <th className="col-secondary">Quality</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && (
              <TableSkeleton
                rows={3}
                columns={6}
                label="Loading WhatsApp numbers"
              />
            )}
            {loaded &&
              items.map((n) => (
                <tr key={n.id}>
                  <td data-label="Label">{n.label}</td>
                  <td data-label="Number">{n.displayPhoneNumber}</td>
                  <td className="col-secondary" data-label="Lifecycle">
                    {n.lifecycle}
                  </td>
                  <td data-label="Active">{n.isActive ? "yes" : "no"}</td>
                  <td className="col-secondary" data-label="Quality">
                    {n.qualityRating ?? "—"}
                  </td>
                  <td className="cell-action" data-label="Action">
                    {!n.isActive && n.lifecycle === "connected" && (
                      <button
                        className="btn"
                        onClick={() =>
                          void api(
                            `/api/settings/whatsapp/numbers/${n.id}/activate`,
                            { method: "POST" },
                          )
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
