"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SideDrawer } from "@/components/SideDrawer";
import { formatNaira, labelStage, labelWaiting } from "@/lib/money";

type OrderRow = {
  id: string;
  ref: string;
  stage: string;
  waitingOn: string;
  riskLevel: string;
  needBy: string | null;
  budgetKobo: number | null;
  conversationId: string;
  customerName: string;
  customerPhone: string | null;
  ownerName: string | null;
  description: string | null;
  invoiceTotalKobo: number;
  paidKobo: number;
  remainingKobo: number;
  paymentStatus: string | null;
  paymentKind: string | null;
  quoteRef: string | null;
  quoteStatus: string | null;
  updatedAt: string;
  createdAt: string;
};

type OrderDetail = {
  order: {
    id: string;
    ref: string;
    stage: string;
    waitingOn: string;
    riskLevel: string;
    riskReasons: unknown;
    needBy: string | null;
    eventDate: string | null;
    budgetKobo: number | null;
    conversationId: string;
    lostReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  customer: {
    name: string;
    phone: string | null;
    waId: string | null;
    email: string | null;
  };
  ownerName: string | null;
  description: string | null;
  invoiceTotalKobo: number;
  paidKobo: number;
  remainingKobo: number;
  quotes: Array<{
    id: string;
    ref: string;
    version: number;
    status: string;
    totalKobo: number;
    subtotalKobo: number;
    deliveryKobo: number;
    discountKobo: number;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    kind: string;
    status: string;
    amountKobo: number;
    paystackReference: string;
    authorizationUrl: string | null;
    paidAt: string | null;
    channel: string | null;
    createdAt: string;
  }>;
  changes: Array<{
    id: string;
    at: string;
    kind: string;
    actorKind: string;
    reason: string | null;
    before: unknown;
    after: unknown;
  }>;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function StageChip({ stage }: { stage: string }) {
  return <span className={`chip stage-${stage}`}>{labelStage(stage)}</span>;
}

function RiskChip({ risk }: { risk: string }) {
  return <span className={`chip risk-${risk}`}>{risk}</span>;
}

export default function OrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<{ items: OrderRow[] }>("/api/orders")
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

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    api<OrderDetail>(`/api/orders/${selectedId}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setDetailError(String(e.message));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedRow = items.find((o) => o.id === selectedId) ?? null;

  return (
    <div>
      <div className="page-head">
        <h1>Orders</h1>
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
              <th>Ref</th>
              <th>Customer</th>
              <th>Item</th>
              <th>Stage</th>
              <th>Waiting</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Remaining</th>
              <th>Owner</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr
                key={o.id}
                className={
                  selectedId === o.id
                    ? "row-clickable selected"
                    : "row-clickable"
                }
                onClick={() => setSelectedId(o.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(o.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open order ${o.ref}`}
              >
                <td>
                  <code>{o.ref}</code>
                </td>
                <td>
                  <div>{o.customerName}</div>
                  {o.customerPhone && (
                    <div className="muted tiny">{o.customerPhone}</div>
                  )}
                </td>
                <td className="clamp-cell">{o.description ?? "—"}</td>
                <td>
                  <StageChip stage={o.stage} />
                </td>
                <td>{labelWaiting(o.waitingOn)}</td>
                <td>{formatNaira(o.invoiceTotalKobo)}</td>
                <td>{formatNaira(o.paidKobo)}</td>
                <td>
                  {o.remainingKobo > 0 ? (
                    formatNaira(o.remainingKobo)
                  ) : (
                    <span className="muted">Paid up</span>
                  )}
                </td>
                <td>{o.ownerName ?? "—"}</td>
                <td className="muted tiny">{formatWhen(o.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="muted table-empty">Loading orders…</p>}
        {!loading && items.length === 0 && (
          <p className="muted table-empty">
            No orders yet — create one from a conversation (Create invoice).
          </p>
        )}
      </div>

      <SideDrawer
        open={Boolean(selectedId)}
        title={detail?.order.ref ?? selectedRow?.ref ?? "Order"}
        subtitle={
          detail?.description ||
          selectedRow?.description ||
          detail?.customer.name ||
          selectedRow?.customerName
        }
        onClose={() => setSelectedId(null)}
        wide
      >
        {detailLoading && <p className="muted">Loading details…</p>}
        {detailError && <p style={{ color: "var(--danger)" }}>{detailError}</p>}
        {detail && (
          <div className="drawer-sections">
            <section>
              <h3>Summary</h3>
              <dl className="detail-grid">
                <dt>Stage</dt>
                <dd>
                  <StageChip stage={detail.order.stage} />
                </dd>
                <dt>Waiting on</dt>
                <dd>{labelWaiting(detail.order.waitingOn)}</dd>
                <dt>Risk</dt>
                <dd>
                  <RiskChip risk={detail.order.riskLevel} />
                </dd>
                <dt>Owner</dt>
                <dd>{detail.ownerName ?? "—"}</dd>
                <dt>Need by</dt>
                <dd>{detail.order.needBy ?? "—"}</dd>
                <dt>Event date</dt>
                <dd>{detail.order.eventDate ?? "—"}</dd>
                <dt>Created</dt>
                <dd>{formatWhen(detail.order.createdAt)}</dd>
                <dt>Updated</dt>
                <dd>{formatWhen(detail.order.updatedAt)}</dd>
              </dl>
            </section>

            <section>
              <h3>Customer</h3>
              <dl className="detail-grid">
                <dt>Name</dt>
                <dd>{detail.customer.name}</dd>
                <dt>Phone</dt>
                <dd>{detail.customer.phone ?? "—"}</dd>
                <dt>Email</dt>
                <dd>{detail.customer.email ?? "—"}</dd>
              </dl>
              <Link
                className="btn secondary"
                href={`/inbox/${detail.order.conversationId}`}
              >
                Open chat
              </Link>
            </section>

            <section>
              <h3>Money</h3>
              <dl className="detail-grid">
                <dt>Invoice total</dt>
                <dd>{formatNaira(detail.invoiceTotalKobo)}</dd>
                <dt>Paid</dt>
                <dd>{formatNaira(detail.paidKobo)}</dd>
                <dt>Remaining</dt>
                <dd>
                  {detail.remainingKobo > 0
                    ? formatNaira(detail.remainingKobo)
                    : "Fully paid"}
                </dd>
                <dt>Budget</dt>
                <dd>
                  {detail.order.budgetKobo != null
                    ? formatNaira(detail.order.budgetKobo)
                    : "—"}
                </dd>
              </dl>
            </section>

            <section>
              <h3>Quotes</h3>
              {detail.quotes.length === 0 && (
                <p className="muted">No quotes yet.</p>
              )}
              <ul className="drawer-list">
                {detail.quotes.map((q) => (
                  <li key={q.id}>
                    <strong>
                      {q.ref} v{q.version}
                    </strong>{" "}
                    · {q.status} · {formatNaira(q.totalKobo)}
                    <div className="muted tiny">
                      Subtotal {formatNaira(q.subtotalKobo)}
                      {q.deliveryKobo
                        ? ` · delivery ${formatNaira(q.deliveryKobo)}`
                        : ""}
                      {q.discountKobo
                        ? ` · discount ${formatNaira(q.discountKobo)}`
                        : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3>Payments</h3>
              {detail.payments.length === 0 && (
                <p className="muted">No payment requests yet.</p>
              )}
              <ul className="drawer-list">
                {detail.payments.map((p) => (
                  <li key={p.id}>
                    <strong>{p.kind}</strong> · {formatNaira(p.amountKobo)} ·{" "}
                    {p.status}
                    <div className="muted tiny">
                      {p.paystackReference}
                      {p.paidAt ? ` · paid ${formatWhen(p.paidAt)}` : ""}
                      {p.channel ? ` · ${p.channel}` : ""}
                    </div>
                    {p.authorizationUrl && p.status !== "paid" && (
                      <a
                        href={p.authorizationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Paystack link
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3>Activity</h3>
              {detail.changes.length === 0 && (
                <p className="muted">No change events yet.</p>
              )}
              <ul className="drawer-list">
                {detail.changes.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.kind}</strong> · {c.actorKind}
                      {c.reason ? ` · ${c.reason}` : ""}
                    </div>
                    <div className="muted tiny">{formatWhen(c.at)}</div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
