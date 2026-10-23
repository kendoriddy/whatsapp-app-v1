"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SideDrawer } from "@/components/SideDrawer";
import { formatWhen } from "@/lib/format";

const LABELS = ["inquiry", "complaint", "order", "spam"] as const;

type ReviewItem = {
  id: string;
  conversationId: string;
  text: string;
  type: string;
  classification: string | null;
  confidence: string | null;
  needsReview: boolean;
  waTimestamp: string;
  customerName: string;
  customerPhone: string | null;
};

export default function AiReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [unclassified, setUnclassified] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<{ items: ReviewItem[]; unclassified: ReviewItem[] }>("/api/ai/review")
      .then((r) => {
        setItems(r.items);
        setUnclassified(r.unclassified);
        setError(null);
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function override(id: string, label: (typeof LABELS)[number]) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/messages/${id}/classification-override`, {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      setSelected(null);
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const rows = [...items, ...unclassified];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>AI review</h1>
          <p className="muted">
            Messages flagged for classification review, plus unclassified
            inbound.
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
              <th>Message</th>
              <th>AI label</th>
              <th>Confidence</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr
                key={m.id}
                className="row-clickable"
                onClick={() => setSelected(m)}
              >
                <td>{m.customerName}</td>
                <td className="clamp-cell">{m.text}</td>
                <td>{m.classification ?? "unclassified"}</td>
                <td>{m.confidence ?? "—"}</td>
                <td className="muted tiny">{formatWhen(m.waTimestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="muted table-empty">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="muted table-empty">
            Queue empty — nothing needs a classification override right now.
          </p>
        )}
      </div>

      <SideDrawer
        open={Boolean(selected)}
        title="Set classification"
        subtitle={selected?.customerName}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="drawer-sections">
            <section>
              <pre className="msg-preview">{selected.text}</pre>
              <dl className="detail-grid">
                <dt>Current</dt>
                <dd>{selected.classification ?? "unclassified"}</dd>
                <dt>Confidence</dt>
                <dd>{selected.confidence ?? "—"}</dd>
                <dt>When</dt>
                <dd>{formatWhen(selected.waTimestamp)}</dd>
              </dl>
              <div className="invoice-form-actions">
                {LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => void override(selected.id, label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Link
                className="btn"
                style={{ marginTop: "0.75rem", display: "inline-flex" }}
                href={`/inbox/${selected.conversationId}`}
              >
                Open chat
              </Link>
            </section>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
