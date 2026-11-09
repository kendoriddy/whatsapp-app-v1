"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { SideDrawer } from "@/components/SideDrawer";
import {
  DrawerSkeleton,
  InlineSkeleton,
  TableSkeleton,
} from "@/components/loading/LoadingState";
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
  status: "processing" | "ready" | "failed";
  error: string | null;
  storagePath: string | null;
  byteSize: number | null;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeDetail = KnowledgeItem & { markdown: string };

const MERLIN_KEY = "auto_send.merlin_replies";

function formatBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(mime: string, filename: string): string {
  const ext = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (ext) return ext;
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word")) return "docx";
  if (mime.includes("sheet") || mime.includes("excel")) return "xlsx";
  if (mime.startsWith("image/")) return mime.slice(6);
  if (mime.includes("markdown") || mime === "text/plain") return "md";
  return mime.split("/").pop() || "file";
}

export default function MerlinSettingsPage() {
  const [auto, setAuto] = useState<Automation | null>(null);
  const [docs, setDocs] = useState<KnowledgeItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    setDetail(null);
    setDetailLoading(true);
    api<KnowledgeDetail>(`/api/settings/knowledge/${selectedId}`)
      .then((d) => {
        setDetail(d);
        setEditTitle(d.title);
        setEditMarkdown(d.markdown);
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setDetailLoading(false));
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
          ? "Merlin is ON — it will answer covered questions from your knowledge base."
          : "Merlin is OFF — only staff reply to customers.",
      );
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploadBusy(true);
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      for (const file of Array.from(fileList)) {
        form.append("files", file);
      }
      const res = await fetch("/api/settings/knowledge", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: { message?: string };
        title?: string;
        items?: { title: string }[];
        errors?: { filename: string; message: string }[];
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Upload failed");
      }
      const n = json.items?.length ?? 0;
      const failN = json.errors?.length ?? 0;
      setNote(
        failN
          ? `Stored ${n} document(s). ${failN} failed: ${json.errors!.map((e) => e.filename).join(", ")}`
          : n === 1
            ? `Stored “${json.items?.[0]?.title ?? json.title}” in the knowledge base.`
            : `Stored ${n} documents in the knowledge base.`,
      );
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
      setNote(`Stored “${row.title}” in the knowledge base.`);
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
        Upload business documents into the knowledge base. When answering is on,
        Merlin replies to customers from those documents the way a staff member
        would — and stays silent when a person must decide (R-2, default off).
      </p>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {note && <p className="invoice-ok">{note}</p>}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>
          Answer on behalf of the business
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {auto?.description ??
            "Merlin may answer customers from the knowledge bank on behalf of the business."}
        </p>
        <button
          type="button"
          className="btn"
          disabled={busy || !auto}
          onClick={() => void toggleMerlin(!auto?.enabled)}
        >
          {auto?.enabled
            ? "Turn Merlin answering OFF"
            : "Turn Merlin answering ON"}
        </button>
        <p className="muted tiny" style={{ marginTop: "0.65rem" }}>
          Status:{" "}
          {!ready ? (
            <InlineSkeleton label="Loading Merlin status" width="3.5rem" />
          ) : (
            <>
              <strong>{auto?.enabled ? "ON" : "OFF"}</strong>
              {auto?.enabled
                ? " — Merlin sends when the knowledge base covers the question."
                : " — staff must reply manually."}
            </>
          )}
        </p>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="page-head">
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>Knowledge base</h2>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              Upload documents Merlin can read — .md, .txt, .csv, .html, .json,
              .docx, .pdf, .xlsx, .pptx, or a photo of a document (max 12MB
              each).
            </p>
          </div>
          <div className="invoice-form-actions">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".md,.txt,.csv,.html,.htm,.json,.docx,.pdf,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.webp,text/*,application/pdf,application/json,image/*"
              hidden
              onChange={(e) => void onUpload(e.target.files)}
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
              {uploadBusy ? "Extracting…" : "Upload documents"}
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
              Save to knowledge base
            </button>
          </div>
        )}

        <div className="table-wrap" style={{ marginTop: "0.85rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th className="col-secondary">Type</th>
                <th>Status</th>
                <th className="col-secondary">Size</th>
                <th>Enabled</th>
                <th className="col-secondary">Updated</th>
              </tr>
            </thead>
            <tbody>
              {!ready && (
                <TableSkeleton
                  rows={4}
                  columns={6}
                  label="Loading knowledge documents"
                />
              )}
              {ready &&
                docs.map((d) => (
                  <tr
                    key={d.id}
                    className="row-clickable"
                    onClick={() => setSelectedId(d.id)}
                  >
                    <td data-label="Title">{d.title}</td>
                    <td className="muted tiny col-secondary" data-label="Type">
                      {typeLabel(d.sourceMime, d.sourceFilename)}
                    </td>
                    <td className="muted tiny" data-label="Status">
                      {d.status === "failed" ? (
                        <span
                          style={{ color: "var(--danger)" }}
                          title={d.error ?? ""}
                        >
                          failed
                        </span>
                      ) : (
                        d.status
                      )}
                    </td>
                    <td className="muted tiny col-secondary" data-label="Size">
                      {formatBytes(d.byteSize)}
                      {d.charCount
                        ? ` · ${d.charCount.toLocaleString()} chars`
                        : ""}
                    </td>
                    <td data-label="Enabled">{d.enabled ? "on" : "off"}</td>
                    <td
                      className="muted tiny col-secondary"
                      data-label="Updated"
                    >
                      {formatWhen(d.updatedAt)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {ready && docs.length === 0 && (
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
        {detailLoading && !detail && (
          <DrawerSkeleton label="Loading document" rows={4} />
        )}
        {detail && (
          <div className="drawer-sections">
            <section>
              {detail.status === "failed" && detail.error && (
                <p style={{ color: "var(--danger)" }}>{detail.error}</p>
              )}
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
                <a
                  className="btn secondary"
                  href={`/api/settings/knowledge/${detail.id}?download=1`}
                  style={{ textDecoration: "none" }}
                >
                  Download original
                </a>
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
