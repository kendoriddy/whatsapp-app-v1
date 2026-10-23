"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

type Summary = {
  headline: string;
  intent: string;
  keyFacts: string[];
  openQuestions: string[];
  nextAction: string;
  urgency: "low" | "medium" | "high";
};

type SummaryResponse = {
  summary: Summary;
  model: string;
  provider: string;
  latencyMs: number;
  messageCount: number;
};

type Pos = { x: number; y: number };

const STORAGE_KEY = "mmabon_ai_panel_pos";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function ThreadAiPanel({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [pos, setPos] = useState<Pos>({ x: 24, y: 24 });
  const drag = useRef<{
    ox: number;
    oy: number;
    px: number;
    py: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Pos;
        if (typeof p.x === "number" && typeof p.y === "number") setPos(p);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [conversationId]);

  const persistPos = useCallback((p: Pos) => {
    setPos(p);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    const el = panelRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.ox;
    const dy = e.clientY - drag.current.oy;
    // position is bottom/right offsets
    const next = {
      x: clamp(drag.current.px - dx, 8, window.innerWidth - 80),
      y: clamp(drag.current.py - dy, 8, window.innerHeight - 80),
    };
    setPos(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setPos((p) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      } catch {
        /* ignore */
      }
      return p;
    });
  };

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<SummaryResponse>(
        `/api/conversations/${conversationId}/ai/summary`,
        {
          method: "POST",
          body: "{}",
        },
      );
      setData(res);
      setOpen(true);
    } catch (err) {
      setError(String((err as Error).message));
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={panelRef}
      className={`ai-panel ${open ? "open" : "collapsed"}`}
      style={{ right: pos.x, bottom: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {!open ? (
        <button
          type="button"
          className="ai-panel-fab"
          onClick={() => {
            setOpen(true);
            if (!data && !loading) void refresh();
          }}
          title="AI thread brief"
        >
          AI
        </button>
      ) : (
        <div className="ai-panel-card">
          <header className="ai-panel-head">
            <div>
              <strong>AI brief</strong>
              <span className="muted ai-panel-drag-hint"> · drag to move</span>
            </div>
            <div className="ai-panel-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={loading}
                onClick={() => void refresh()}
              >
                {loading ? "…" : "Refresh"}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setOpen(false)}
                aria-label="Collapse"
              >
                −
              </button>
            </div>
          </header>

          {error && <p className="ai-panel-error">{error}</p>}

          {data ? (
            <div className="ai-panel-body">
              <p className={`ai-urgency ${data.summary.urgency}`}>
                {data.summary.urgency} urgency
              </p>
              <h3>{data.summary.headline}</h3>
              <p className="muted">{data.summary.intent}</p>

              {data.summary.keyFacts.length > 0 && (
                <>
                  <h4>Key facts</h4>
                  <ul>
                    {data.summary.keyFacts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              )}

              {data.summary.openQuestions.length > 0 && (
                <>
                  <h4>Still unclear</h4>
                  <ul>
                    {data.summary.openQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </>
              )}

              <h4>Suggested next step</h4>
              <p>{data.summary.nextAction}</p>

              <p className="muted ai-panel-meta">
                {data.provider}/{data.model} · {data.messageCount} msgs ·{" "}
                {data.latencyMs}ms
              </p>
            </div>
          ) : (
            !loading &&
            !error && (
              <p className="muted">
                Click Refresh for a grounded summary of this thread.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
