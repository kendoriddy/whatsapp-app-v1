"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { ConversationList } from "@/components/ConversationList";
import { ThreadAiPanel } from "@/components/ThreadAiPanel";
import { ThreadInvoicePanel } from "@/components/ThreadInvoicePanel";

const RAIL_KEY = "mmabon_chat_rail_open";

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  textBody: string | null;
  caption: string | null;
  type: string;
  status: string;
  classification: string | null;
  waTimestamp: string;
};

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    setRailOpen(localStorage.getItem(RAIL_KEY) === "1");
  }, []);

  function toggleRail() {
    setRailOpen((open) => {
      const next = !open;
      localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      return next;
    });
  }

  const load = () =>
    api<{ items: Msg[] }>(`/api/conversations/${params.id}/messages`)
      .then((r) => setMessages(r.items))
      .catch((e) => setError(String(e.message)));

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [params.id]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await api(`/api/conversations/${params.id}/outbound`, {
        method: "POST",
        body: JSON.stringify({
          kind: "text",
          body_text: text,
          action: "send",
          idempotency_key: crypto.randomUUID(),
        }),
      });
      setText("");
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={railOpen ? "thread-page rail-open" : "thread-page"}>
      <aside
        id="other-chats"
        className="chat-rail panel"
        aria-label="Other chats"
      >
        <div className="chat-rail-head">Chats</div>
        <ConversationList activeId={params.id} plain />
      </aside>
      <div className="thread">
        <div className="thread-title">
          <button
            type="button"
            className="icon-btn chat-rail-toggle"
            aria-expanded={railOpen}
            aria-controls="other-chats"
            aria-label={railOpen ? "Hide other chats" : "Show other chats"}
            title={railOpen ? "Hide other chats" : "Show other chats"}
            onClick={toggleRail}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <h1>Thread</h1>
        </div>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="panel thread-scroll">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`msg ${m.direction === "inbound" ? "in" : "out"}`}
            >
              <div>{m.textBody ?? m.caption ?? `[${m.type}]`}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {m.direction === "outbound"
                  ? m.status
                  : (m.classification ?? "inbound")}
              </div>
            </div>
          ))}
        </div>
        <div className="composer">
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply…"
          />
          <button
            className="btn"
            disabled={!text || sending}
            onClick={() => void send()}
          >
            Send
          </button>
        </div>
        <ThreadInvoicePanel
          conversationId={params.id}
          onSent={() => void load()}
        />
        <ThreadAiPanel conversationId={params.id} />
      </div>
    </div>
  );
}
