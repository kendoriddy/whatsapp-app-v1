"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { ConversationList } from "@/components/ConversationList";
import { ThreadAiPanel } from "@/components/ThreadAiPanel";
import { ThreadInvoicePanel } from "@/components/ThreadInvoicePanel";
import { formatTime } from "@/lib/format";

const RAIL_KEY = "mmabon_chat_rail_open";
const NEAR_BOTTOM_PX = 80;

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
  const [showJumpBottom, setShowJumpBottom] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stickToBottom.current = true;
    setShowJumpBottom(false);
  }, []);

  const updateNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distance <= NEAR_BOTTOM_PX;
    stickToBottom.current = near;
    setShowJumpBottom(!near && el.scrollHeight > el.clientHeight + 24);
  }, []);

  const load = useCallback(() => {
    return api<{ items: Msg[] }>(`/api/conversations/${params.id}/messages`)
      .then((r) => setMessages(r.items))
      .catch((e) => setError(String(e.message)));
  }, [params.id]);

  useEffect(() => {
    stickToBottom.current = true;
    setMessages([]);
    setShowJumpBottom(false);
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [params.id, load]);

  // Pin to latest on open and while the user stays near the bottom.
  useEffect(() => {
    if (messages.length === 0) return;
    if (stickToBottom.current) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    } else {
      updateNearBottom();
    }
  }, [messages, scrollToBottom, updateNearBottom]);

  // Spec: viewing a thread resets unread_count (also while new inbound arrives).
  useEffect(() => {
    const markRead = () =>
      void api(`/api/conversations/${params.id}/read`, {
        method: "POST",
        body: "{}",
      }).catch(() => undefined);
    markRead();
    const t = setInterval(markRead, 10000);
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
      stickToBottom.current = true;
      await load();
      requestAnimationFrame(() => scrollToBottom("smooth"));
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
        <div className="thread-scroll-wrap">
          <div
            ref={scrollRef}
            className="panel thread-scroll"
            onScroll={updateNearBottom}
          >
            {messages.length === 0 && (
              <p className="muted">No messages in this thread yet.</p>
            )}
            {messages.map((m) => {
              const label = m.direction === "inbound" ? "Customer" : "Staff";
              const meta =
                m.direction === "outbound"
                  ? m.status
                  : (m.classification ?? m.type);
              return (
                <div
                  key={m.id}
                  className={`msg ${m.direction === "inbound" ? "in" : "out"}`}
                >
                  <div className="msg-meta">
                    <span className="msg-label">{label}</span>
                    <span className="msg-time">
                      {formatTime(m.waTimestamp)}
                    </span>
                  </div>
                  <div className="msg-body">
                    {m.textBody ?? m.caption ?? `[${m.type}]`}
                  </div>
                  <div className="msg-foot muted">
                    {meta}
                    {m.type !== "text" ? ` · ${m.type}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
          {showJumpBottom && (
            <button
              type="button"
              className="scroll-bottom-btn"
              aria-label="Jump to latest message"
              title="Jump to latest"
              onClick={() => scrollToBottom("smooth")}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M19 12l-7 7-7-7" />
              </svg>
            </button>
          )}
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
          onSent={() => {
            stickToBottom.current = true;
            void load().then(() =>
              requestAnimationFrame(() => scrollToBottom("smooth")),
            );
          }}
        />
        <ThreadAiPanel conversationId={params.id} />
      </div>
    </div>
  );
}
