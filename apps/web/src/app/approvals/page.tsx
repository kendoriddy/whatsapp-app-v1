"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SideDrawer } from "@/components/SideDrawer";
import { formatWhen } from "@/lib/format";

type Approval = {
  id: string;
  conversationId: string;
  kind: string;
  bodyText: string | null;
  origin: string;
  status: string;
  createdAt: string;
  createdByName: string | null;
  customerName: string;
  customerPhone: string | null;
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<{ items: Approval[] }>("/api/approvals")
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/approvals/${id}`, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason:
            action === "reject" ? "Rejected from approvals queue" : undefined,
        }),
      });
      setSelected(null);
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p className="muted">
            Outbound messages waiting for SEND_ROLES approval.
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="panel table-wrap" style={{ marginTop: "1rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Preview</th>
              <th>Origin</th>
              <th>Submitted</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr
                key={a.id}
                className="row-clickable"
                onClick={() => setSelected(a)}
              >
                <td>
                  {a.customerName}
                  {a.customerPhone && (
                    <div className="muted tiny">{a.customerPhone}</div>
                  )}
                </td>
                <td className="clamp-cell">{a.bodyText ?? `[${a.kind}]`}</td>
                <td>{a.origin}</td>
                <td className="muted tiny">{formatWhen(a.createdAt)}</td>
                <td>{a.createdByName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="muted table-empty">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="muted table-empty">
            Empty — no pending approvals. Designer/production submits land here;
            sales/admin/manager can approve & send.
          </p>
        )}
      </div>

      <SideDrawer
        open={Boolean(selected)}
        title="Approve outbound"
        subtitle={selected?.customerName}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="drawer-sections">
            <section>
              <pre className="msg-preview">
                {selected.bodyText ?? `[${selected.kind}]`}
              </pre>
              <dl className="detail-grid">
                <dt>Origin</dt>
                <dd>{selected.origin}</dd>
                <dt>Submitted</dt>
                <dd>{formatWhen(selected.createdAt)}</dd>
                <dt>By</dt>
                <dd>{selected.createdByName ?? "—"}</dd>
              </dl>
              <div className="invoice-form-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void act(selected.id, "approve")}
                >
                  Approve & send
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => void act(selected.id, "reject")}
                >
                  Reject
                </button>
                <Link
                  className="btn secondary"
                  href={`/inbox/${selected.conversationId}`}
                >
                  Open chat
                </Link>
              </div>
            </section>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
