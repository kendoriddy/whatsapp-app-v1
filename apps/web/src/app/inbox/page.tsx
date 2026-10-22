"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

type Conv = {
  id: string;
  lastMessagePreview: string | null;
  lastInboundClass: string | null;
  unreadCount: number;
  status: string;
  contact: { profileName: string | null; e164: string; displayName: string | null };
  window_expires_at: string | null;
};

export default function InboxPage() {
  const [items, setItems] = useState<Conv[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Conv[] }>("/api/conversations")
      .then((r) => setItems(r.items))
      .catch((e) => setError(String(e.message)));
  }, []);

  return (
    <div>
      <h1>Inbox</h1>
      <p className="muted">Shared WhatsApp conversations</p>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="panel list" style={{ marginTop: "1rem" }}>
        {items.length === 0 && !error && <p className="muted">No conversations yet. Replay fixtures or wait for inbound.</p>}
        {items.map((c) => (
          <Link key={c.id} href={`/inbox/${c.id}`} className="list-item">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{c.contact.displayName ?? c.contact.profileName ?? c.contact.e164}</strong>
              {c.lastInboundClass && <span className="chip">{c.lastInboundClass}</span>}
            </div>
            <div className="muted">{c.lastMessagePreview ?? "—"}</div>
            {c.unreadCount > 0 && <span className="chip open">{c.unreadCount} unread</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
