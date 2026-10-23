"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { SideDrawer } from "@/components/SideDrawer";
import { formatWhen } from "@/lib/format";

type AuditRow = {
  id: number;
  at: string;
  actorKind: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ items: AuditRow[] }>("/api/audit")
      .then((r) => setItems(r.items))
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Audit log</h1>
      <p className="muted">Staff and system actions.</p>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="panel table-wrap" style={{ marginTop: "1rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className="row-clickable"
                onClick={() => setSelected(row)}
              >
                <td className="muted tiny">{formatWhen(row.at)}</td>
                <td>
                  {row.actorName ?? row.actorKind}
                  <div className="muted tiny">{row.actorKind}</div>
                </td>
                <td>
                  <code>{row.action}</code>
                </td>
                <td>
                  {row.entityType}
                  <div className="muted tiny clamp-cell">{row.entityId}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="muted table-empty">Loading…</p>}
        {!loading && items.length === 0 && !error && (
          <p className="muted table-empty">
            No audit events yet. Overrides, approvals, and WhatsApp number
            changes will appear here.
          </p>
        )}
      </div>

      <SideDrawer
        open={Boolean(selected)}
        title={selected?.action ?? "Audit event"}
        subtitle={selected ? formatWhen(selected.at) : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="drawer-sections">
            <section>
              <h3>Meta</h3>
              <dl className="detail-grid">
                <dt>Actor</dt>
                <dd>{selected.actorName ?? selected.actorKind}</dd>
                <dt>Entity</dt>
                <dd>
                  {selected.entityType} / {selected.entityId}
                </dd>
              </dl>
            </section>
            <section>
              <h3>Before</h3>
              <pre className="json-block">
                {JSON.stringify(selected.before, null, 2) ?? "null"}
              </pre>
            </section>
            <section>
              <h3>After</h3>
              <pre className="json-block">
                {JSON.stringify(selected.after, null, 2) ?? "null"}
              </pre>
            </section>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
