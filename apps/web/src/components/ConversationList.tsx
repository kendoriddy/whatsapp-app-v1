"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

type Conv = {
  id: string;
  lastMessagePreview: string | null;
  lastInboundClass: string | null;
  unreadCount: number;
  contact: {
    profileName: string | null;
    e164: string;
    displayName: string | null;
  };
};

function contactLabel(c: Conv) {
  return c.contact.displayName ?? c.contact.profileName ?? c.contact.e164;
}

export function ConversationList({
  activeId,
  plain = false,
}: {
  activeId?: string;
  plain?: boolean;
}) {
  const [items, setItems] = useState<Conv[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api<{ items: Conv[] }>("/api/conversations")
      .then((r) =>
        setItems(
          r.items.map((c) =>
            activeId && c.id === activeId ? { ...c, unreadCount: 0 } : c,
          ),
        ),
      )
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoaded(true));
  }, [activeId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div
      className={
        plain ? "list conversation-list" : "panel list conversation-list"
      }
    >
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {loaded && items.length === 0 && !error && (
        <p className="muted">
          No conversations yet. Replay fixtures or wait for inbound.
        </p>
      )}
      {items.map((c) => {
        const active = c.id === activeId;
        return (
          <Link
            key={c.id}
            href={`/inbox/${c.id}`}
            className={active ? "list-item active" : "list-item"}
            aria-current={active ? "page" : undefined}
          >
            <div className="conversation-row">
              <strong>{contactLabel(c)}</strong>
              {c.lastInboundClass && (
                <span className="chip">{c.lastInboundClass}</span>
              )}
            </div>
            <div className="muted conversation-preview">
              {c.lastMessagePreview ?? "—"}
            </div>
            {c.unreadCount > 0 && (
              <span className="chip open">{c.unreadCount} unread</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
