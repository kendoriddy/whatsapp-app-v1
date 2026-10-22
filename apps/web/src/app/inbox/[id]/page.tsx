"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";

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
    <div className="thread">
      <h1>Thread</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="panel thread-scroll">
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.direction === "inbound" ? "in" : "out"}`}>
            <div>{m.textBody ?? m.caption ?? `[${m.type}]`}</div>
            <div className="muted" style={{ marginTop: 4 }}>
              {m.direction === "outbound" ? m.status : m.classification ?? "inbound"}
            </div>
          </div>
        ))}
      </div>
      <div className="composer">
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" />
        <button className="btn" disabled={!text || sending} onClick={() => void send()}>
          Send
        </button>
      </div>
    </div>
  );
}
