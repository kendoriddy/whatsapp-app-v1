"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SideDrawer } from "@/components/SideDrawer";
import { formatNaira } from "@/lib/money";
import { formatWhen } from "@/lib/format";

type FollowItem = {
  id: string;
  kind: "followup" | "suggestion";
  reason: string;
  status: string;
  dueAt: string | null;
  orderId: string | null;
  orderRef: string | null;
  conversationId: string;
  customerName: string;
  customerPhone: string | null;
  remainingKobo: number | null;
  paidKobo: number | null;
  invoiceTotalKobo: number | null;
};

export default function FollowupsPage() {
  const [items, setItems] = useState<FollowItem[]>([]);
  const [suggestions, setSuggestions] = useState<FollowItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FollowItem | null>(null);

  useEffect(() => {
    api<{ items: FollowItem[]; suggestions: FollowItem[] }>("/api/followups")
      .then((r) => {
        setItems(r.items);
        setSuggestions(r.suggestions);
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
  }, []);

  const rows = [...items, ...suggestions];

  return (
    <div>
      <h1>Follow-ups</h1>
      <p className="muted">
        Open follow-ups and balance-due suggestions from partial payments.
      </p>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="panel table-wrap" style={{ marginTop: "1rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Reason</th>
              <th>Order</th>
              <th>Remaining</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr
                key={f.id}
                className="row-clickable"
                onClick={() => setSelected(f)}
              >
                <td>
                  {f.customerName}
                  {f.customerPhone && (
                    <div className="muted tiny">{f.customerPhone}</div>
                  )}
                </td>
                <td>{f.reason.replace(/_/g, " ")}</td>
                <td>{f.orderRef ?? "—"}</td>
                <td>
                  {f.remainingKobo != null ? formatNaira(f.remainingKobo) : "—"}
                </td>
                <td className="muted tiny">
                  {f.dueAt ? formatWhen(f.dueAt) : "—"}
                </td>
                <td>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="muted table-empty">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="muted table-empty">
            No open follow-ups. Partial deposits with a remaining balance will
            show here as balance-due suggestions.
          </p>
        )}
      </div>

      <SideDrawer
        open={Boolean(selected)}
        title={selected?.reason.replace(/_/g, " ") ?? "Follow-up"}
        subtitle={selected?.customerName}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="drawer-sections">
            <section>
              <dl className="detail-grid">
                <dt>Order</dt>
                <dd>{selected.orderRef ?? "—"}</dd>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
                {selected.invoiceTotalKobo != null && (
                  <>
                    <dt>Invoice</dt>
                    <dd>{formatNaira(selected.invoiceTotalKobo)}</dd>
                    <dt>Paid</dt>
                    <dd>{formatNaira(selected.paidKobo ?? 0)}</dd>
                    <dt>Remaining</dt>
                    <dd>{formatNaira(selected.remainingKobo ?? 0)}</dd>
                  </>
                )}
                <dt>Due</dt>
                <dd>{selected.dueAt ? formatWhen(selected.dueAt) : "—"}</dd>
              </dl>
              <Link className="btn" href={`/inbox/${selected.conversationId}`}>
                Open chat
              </Link>
            </section>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
