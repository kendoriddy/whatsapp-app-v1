"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatNaira, labelStage } from "@/lib/money";
import { formatWhen } from "@/lib/format";

type Summary = {
  open_conversations: number;
  inbound_7d: number;
  pending_approvals: number;
  classification_needs_review: number;
  open_orders: number;
  payments_7d_count: number;
  payments_7d_kobo: number;
  outstanding_kobo: number;
  orders_by_stage: Record<string, number>;
  recent_messages: Array<{
    id: string;
    conversationId: string;
    direction: string;
    textBody: string | null;
    caption: string | null;
    type: string;
    classification: string | null;
    waTimestamp: string;
  }>;
  recent_payments: Array<{
    id: string;
    amountKobo: number;
    status: string;
    kind: string;
    reference: string;
    paidAt: string | null;
  }>;
  recent_orders: Array<{
    id: string;
    ref: string;
    stage: string;
    budgetKobo: number | null;
    updatedAt: string;
    conversationId: string;
  }>;
};

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/api/dashboard/summary")
      .then(setS)
      .catch((e) => setError(String(e.message)));
  }, []);

  const stages = Object.entries(s?.orders_by_stage ?? {});

  return (
    <div>
      <h1>Dashboard</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="grid-cards" style={{ marginTop: "1rem" }}>
        {[
          ["Open chats", s?.open_conversations, "/inbox"],
          ["Inbound (7d)", s?.inbound_7d, "/inbox"],
          ["Open orders", s?.open_orders, "/orders"],
          ["Pending approvals", s?.pending_approvals, "/approvals"],
          ["AI needs review", s?.classification_needs_review, "/ai/review"],
          [
            "Paid (7d)",
            s
              ? `${s.payments_7d_count} · ${formatNaira(s.payments_7d_kobo)}`
              : null,
            "/orders",
          ],
          [
            "Outstanding",
            s ? formatNaira(s.outstanding_kobo) : null,
            "/followups",
          ],
        ].map(([label, val, href]) => (
          <Link
            className="panel card-stat card-stat-link"
            key={String(label)}
            href={String(href)}
          >
            <h3>{label}</h3>
            <p>{val ?? "—"}</p>
          </Link>
        ))}
      </div>

      <div className="dash-columns" style={{ marginTop: "1.25rem" }}>
        <section className="panel">
          <h2>Orders by stage</h2>
          {stages.length === 0 && <p className="muted">No orders yet.</p>}
          <ul className="dash-list">
            {stages.map(([stage, c]) => (
              <li key={stage}>
                <span>{labelStage(stage)}</span>
                <strong>{c}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Recent orders</h2>
          {!s?.recent_orders?.length && <p className="muted">None yet.</p>}
          <ul className="dash-list">
            {s?.recent_orders?.map((o) => (
              <li key={o.id}>
                <Link href="/orders">
                  <code>{o.ref}</code> · {labelStage(o.stage)}
                </Link>
                <span className="muted tiny">{formatWhen(o.updatedAt)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Recent payments</h2>
          {!s?.recent_payments?.length && <p className="muted">None yet.</p>}
          <ul className="dash-list">
            {s?.recent_payments?.map((p) => (
              <li key={p.id}>
                <span>
                  {p.kind} · {formatNaira(p.amountKobo)} · {p.status}
                </span>
                <span className="muted tiny">
                  {formatWhen(p.paidAt ?? undefined)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Latest messages</h2>
          {!s?.recent_messages?.length && <p className="muted">None yet.</p>}
          <ul className="dash-list">
            {s?.recent_messages?.map((m) => (
              <li key={m.id}>
                <Link href={`/inbox/${m.conversationId}`}>
                  <span className="muted">
                    {m.direction === "inbound" ? "Customer" : "Staff"}
                    {m.classification ? ` · ${m.classification}` : ""}
                  </span>
                  <div className="clamp-2">
                    {m.textBody ?? m.caption ?? `[${m.type}]`}
                  </div>
                </Link>
                <span className="muted tiny">{formatWhen(m.waTimestamp)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
