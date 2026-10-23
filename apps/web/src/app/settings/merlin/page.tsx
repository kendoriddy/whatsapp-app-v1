"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SideDrawer } from "@/components/SideDrawer";
import { formatWhen } from "@/lib/format";

type Automation = {
  key: string;
  enabled: boolean;
  description: string;
  allowedOrigin: string;
  config: Record<string, unknown>;
};

type KnowledgeItem = {
  id: string;
  title: string;
  sourceFilename: string;
  sourceMime: string;
  charCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeDetail = KnowledgeItem & { markdown: string };

const MERLIN_KEY = "auto_send.merlin_replies";

export default function MerlinSettingsPage() {
  const [auto, setAuto] = useState<Automation | null>(null);
  const [docs, setDocs] = useState<KnowledgeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDetail | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMarkdown, setEditMarkdown] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteMarkdown, setPasteMarkdown] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, k] = await Promise.all([
        api<{ items: Automation[] }>("/api/settings/automation"),
        api<{ items: KnowledgeItem[] }>("/api/settings/knowledge"),
      ]);
      setAuto(a.items.find((i) => i.key === MERLIN_KEY) ?? null);
      setDocs(k.items);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api<KnowledgeDetail>(`/api/settings/knowledge/${selectedId}`)
      .then((d) => {
        setDetail(d);
        setEditTitle(d.title);
        setEditMarkdown(d.markdown);
      })
      .catch((e) => setError(String(e.message)));
  }, [selectedId]);

  async function toggleMerlin(enabled: boolean) {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      await api("/api/settings/automation", {
        method: "PATCH",
        body: JSON.stringify({ key: MERLIN_KEY, enabled }),
      });
      setNote(
        enabled
          ? "Merlin auto-reply is ON. Upload knowledge docs so answers stay grounded."
          : "Merlin auto-reply is OFF.",
      );
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/settings/knowledge", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: { message?: string };
        title?: string;
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Upload failed");
      }
      setNote(`Stored “${json.title}” as markdown.`);
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function savePaste() {
    if (!pasteMarkdown.trim()) {
      setError("Paste some markdown first");
      return;
    }
    setUploadBusy(true);
    setError(null);
    setNote(null);
    try {
      const row = await api<{ title: string }>("/api/settings/knowledge", {
        method: "POST",
        body: JSON.stringify({
          title: pasteTitle.trim() || "Untitled note",
          markdown: pasteMarkdown,
        }),
      });
      setPasteOpen(false);
      setPasteTitle("");
      setPasteMarkdown("");
      setNote(`Stored “${row.title}” as markdown.`);
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setUploadBusy(false);
    }
  }

  async function saveDoc() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/settings/knowledge/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle,
          markdown: editMarkdown,
        }),
      });
      setNote("Document saved.");
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDoc(id: string, enabled: boolean) {
    setBusy(true);
    try {
      await api(`/api/settings/knowledge/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      await load();
      if (detail?.id === id) {
        setDetail({ ...detail, enabled });
      }
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this knowledge document?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/knowledge/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const json = (await res.json()) as { error?: { message?: string } };
        throw new Error(json.error?.message ?? "Delete failed");
      }
      setSelectedId(null);
      setNote("Document deleted.");
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: "0.35rem" }}>
        <Link href="/settings">Settings</Link> / Merlin
      </p>
      <h1>Merlin</h1>
      <p className="muted">
        When auto-reply is on, Merlin answers inbound WhatsApp using your
        knowledge bank (R-2 automation — default off).
      </p>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {note && <p className="invoice-ok">{note}</p>}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Auto-reply</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {auto?.description ??
            "Merlin may auto-reply to customers from the knowledge bank."}
        </p>
        <button
          type="button"
          className="btn"
          disabled={busy || !auto}
          onClick={() => void toggleMerlin(!auto?.enabled)}
        >
          {auto?.enabled
            ? "Turn Merlin auto-reply OFF"
            : "Turn Merlin auto-reply ON"}
        </button>
        <p className="muted tiny" style={{ marginTop: "0.65rem" }}>
          Status: <strong>{auto?.enabled ? "ON" : "OFF"}</strong>
          {auto?.enabled
            ? " — Merlin will send when it has a safe answer."
            : " — staff must reply manually."}
        </p>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="page-head">
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Knowledge bank</h2>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              Upload any supported file — we extract and store markdown Merlin
              can read (.md, .txt, .csv, .html, .json, .docx, .pdf).
            </p>
          </div>
          <div className="invoice-form-actions">
            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt,.csv,.html,.htm,.json,.docx,.pdf,text/*,application/pdf,application/json"
              hidden
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn secondary"
              disabled={uploadBusy}
              onClick={() => setPasteOpen((v) => !v)}
            >
              Paste markdown
            </button>
            <button
              type="button"
              className="btn"
              disabled={uploadBusy}
              onClick={() => fileRef.current?.click()}
            >
              {uploadBusy ? "Extracting…" : "Upload document"}
            </button>
          </div>
        </div>

        {pasteOpen && (
          <div className="invoice-form" style={{ marginTop: "0.85rem" }}>
            <label>
              Title
              <input
                className="input"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="e.g. Delivery policy"
              />
            </label>
            <label>
              Markdown
              <textarea
                className="textarea"
                rows={8}
                value={pasteMarkdown}
                onChange={(e) => setPasteMarkdown(e.target.value)}
                placeholder="# FAQs&#10;…"
                style={{ fontFamily: "var(--mono)", fontSize: "0.85rem" }}
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={uploadBusy || !pasteMarkdown.trim()}
              onClick={() => void savePaste()}
            >
              Save to knowledge bank
            </button>
          </div>
        )}

        <div className="table-wrap" style={{ marginTop: "0.85rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Size</th>
                <th>Enabled</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr
                  key={d.id}
                  className="row-clickable"
                  onClick={() => setSelectedId(d.id)}
                >
                  <td>{d.title}</td>
                  <td className="muted tiny">{d.sourceFilename}</td>
                  <td className="muted tiny">
                    {d.charCount.toLocaleString()} chars
                  </td>
                  <td>{d.enabled ? "on" : "off"}</td>
                  <td className="muted tiny">{formatWhen(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {docs.length === 0 && (
            <p className="muted table-empty">
              No documents yet. Upload FAQs, price lists, or policies so Merlin
              has something to cite.
            </p>
          )}
        </div>
      </section>

      <SideDrawer
        open={Boolean(selectedId)}
        title={detail?.title ?? "Document"}
        subtitle={detail?.sourceFilename}
        onClose={() => setSelectedId(null)}
        wide
      >
        {detail && (
          <div className="drawer-sections">
            <section>
              <label>
                Title
                <input
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </label>
              <label
                style={{
                  marginTop: "0.65rem",
                  display: "grid",
                  gap: "0.25rem",
                }}
              >
                Markdown
                <textarea
                  className="textarea"
                  rows={16}
                  value={editMarkdown}
                  onChange={(e) => setEditMarkdown(e.target.value)}
                  style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}
                />
              </label>
              <div
                className="invoice-form-actions"
                style={{ marginTop: "0.75rem" }}
              >
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void saveDoc()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => void toggleDoc(detail.id, !detail.enabled)}
                >
                  {detail.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => void deleteDoc(detail.id)}
                >
                  Delete
                </button>
              </div>
            </section>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
