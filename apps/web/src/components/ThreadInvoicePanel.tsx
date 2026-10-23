"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";

type Payment = {
  id: string;
  status: string;
  amountKobo: number;
  authorizationUrl: string | null;
  paystackReference: string;
  kind: string;
  createdAt: string;
};

type Quote = {
  id: string;
  ref: string;
  version: number;
  status: string;
  totalKobo: number;
};

type OrderBundle = {
  order: { id: string; ref: string; stage: string };
  quotes: Quote[];
  payments: Payment[];
};

type AdvanceMode = "full" | "percent" | "amount";

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function ThreadInvoicePanel({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amountNaira, setAmountNaira] = useState("");
  const [deliveryNaira, setDeliveryNaira] = useState("");
  const [needBy, setNeedBy] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>("percent");
  const [depositPercent, setDepositPercent] = useState("50");
  const [depositAmount, setDepositAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [merlinBusy, setMerlinBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [merlinNote, setMerlinNote] = useState<string | null>(null);
  const [items, setItems] = useState<OrderBundle[]>([]);

  const load = useCallback(() => {
    api<{ items: OrderBundle[] }>(
      `/api/conversations/${conversationId}/payments`,
    )
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [conversationId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const preview = useMemo(() => {
    const goods = Number(amountNaira);
    const delivery = Number(deliveryNaira) || 0;
    if (!Number.isFinite(goods) || goods <= 0) return null;
    const totalKobo = toKobo(goods) + toKobo(delivery);
    let chargeKobo = totalKobo;
    if (advanceMode === "percent") {
      const pct = Number(depositPercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
      chargeKobo = Math.round((totalKobo * pct) / 100);
    } else if (advanceMode === "amount") {
      const dep = Number(depositAmount);
      if (!Number.isFinite(dep) || dep <= 0) return null;
      chargeKobo = toKobo(dep);
      if (chargeKobo > totalKobo) return null;
    }
    return {
      subtotalKobo: toKobo(goods),
      deliveryKobo: toKobo(delivery),
      totalKobo,
      chargeKobo,
      remainingKobo: Math.max(0, totalKobo - chargeKobo),
    };
  }, [amountNaira, deliveryNaira, advanceMode, depositPercent, depositAmount]);

  async function askMerlin() {
    setMerlinBusy(true);
    setError(null);
    setMerlinNote(null);
    try {
      const res = await api<{
        draft: {
          description: string | null;
          amount_naira: number | null;
          delivery_naira: number | null;
          deposit_percent: number | null;
          need_by: string | null;
          event_date: string | null;
          notes: string | null;
        };
      }>(`/api/conversations/${conversationId}/ai/invoice-draft`, {
        method: "POST",
        body: "{}",
      });
      const d = res.draft;
      if (d.description) setDescription(d.description);
      if (d.amount_naira != null) setAmountNaira(String(d.amount_naira));
      if (d.delivery_naira != null) setDeliveryNaira(String(d.delivery_naira));
      if (d.need_by) setNeedBy(d.need_by);
      if (d.event_date) setEventDate(d.event_date);
      if (d.deposit_percent != null) {
        setAdvanceMode("percent");
        setDepositPercent(String(d.deposit_percent));
      }
      const dateBits = [
        d.need_by ? `need by ${d.need_by}` : null,
        d.event_date ? `event ${d.event_date}` : null,
      ].filter(Boolean);
      setMerlinNote(
        d.notes ||
          (d.amount_naira == null
            ? "Merlin couldn’t find a clear amount — please fill manually."
            : dateBits.length
              ? `Filled from chat (${dateBits.join(", ")}). Review before sending.`
              : "Fields filled from the chat. Review before sending."),
      );
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setMerlinBusy(false);
    }
  }

  async function createInvoice() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const amount = Number(amountNaira);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a positive amount in naira");
      }
      if (!preview) {
        throw new Error("Check advance payment amount / percent");
      }

      const body: Record<string, unknown> = {
        description: description.trim() || "Order",
        amount_naira: amount,
        delivery_naira: Number(deliveryNaira) || 0,
        need_by: needBy || null,
        event_date: eventDate || null,
      };

      if (advanceMode === "full") {
        body.payment_kind = "full";
      } else if (advanceMode === "percent") {
        body.payment_kind = "deposit";
        body.deposit_percent = Number(depositPercent);
      } else {
        body.payment_kind = "deposit";
        body.deposit_amount_naira = Number(depositAmount);
      }

      const res = await api<{
        order: { ref: string };
        payment: { status: string; authorizationUrl: string | null };
        outbound: { status: string } | null;
        totals: {
          invoice_total_kobo: number;
          charge_kobo: number;
          remaining_kobo: number;
          payment_kind: string;
        };
      }>(`/api/conversations/${conversationId}/invoice`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setOk(
        `${res.order.ref}: charge ${formatNaira(res.totals.charge_kobo)}` +
          (res.totals.remaining_kobo > 0
            ? ` · remaining ${formatNaira(res.totals.remaining_kobo)}`
            : " · fully covered") +
          ` · link ${res.outbound?.status ?? res.payment.status}`,
      );
      setDescription("");
      setAmountNaira("");
      setDeliveryNaira("");
      setNeedBy("");
      setEventDate("");
      setDepositAmount("");
      await load();
      onSent?.();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const latestPay = items[0]?.payments[0];
  const latestQuote = items[0]?.quotes[0];

  return (
    <div className="invoice-panel">
      <button
        type="button"
        className="btn secondary"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide invoice" : "Create invoice"}
      </button>

      {latestPay &&
        !open &&
        (() => {
          const paidTotal = items[0]!.payments
            .filter((p) => p.status === "paid")
            .reduce((s, p) => s + p.amountKobo, 0);
          const remaining =
            latestQuote != null
              ? Math.max(0, latestQuote.totalKobo - paidTotal)
              : null;
          const parts = [items[0]?.order.ref];
          if (latestPay.status === "paid") {
            parts.push(`paid ${formatNaira(latestPay.amountKobo)} ✓`);
            if (paidTotal > latestPay.amountKobo) {
              parts.push(`total paid ${formatNaira(paidTotal)}`);
            }
            if (remaining != null) {
              parts.push(
                remaining > 0
                  ? `remaining ${formatNaira(remaining)}`
                  : "fully paid",
              );
            }
          } else {
            parts.push(
              `${latestPay.kind} ${formatNaira(latestPay.amountKobo)} · ${latestPay.status}`,
            );
          }
          return (
            <span className="muted invoice-status">{parts.join(" · ")}</span>
          );
        })()}

      {open && (
        <div className="invoice-form panel">
          <div className="invoice-form-actions">
            <button
              type="button"
              className="btn secondary"
              disabled={merlinBusy}
              onClick={() => void askMerlin()}
            >
              {merlinBusy ? "Merlin…" : "Ask Merlin to fill"}
            </button>
          </div>
          {merlinNote && (
            <p className="muted invoice-merlin-note">{merlinNote}</p>
          )}

          <label>
            Description
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 50 branded tees"
            />
          </label>
          <label>
            Amount (₦)
            <input
              className="input"
              type="number"
              min="1"
              step="0.01"
              value={amountNaira}
              onChange={(e) => setAmountNaira(e.target.value)}
              placeholder="50000"
            />
          </label>
          <label>
            Delivery (₦, optional)
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={deliveryNaira}
              onChange={(e) => setDeliveryNaira(e.target.value)}
              placeholder="0"
            />
          </label>
          <div className="invoice-dates">
            <label>
              Need by
              <input
                className="input"
                type="date"
                value={needBy}
                onChange={(e) => setNeedBy(e.target.value)}
              />
            </label>
            <label>
              Event date
              <input
                className="input"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </label>
          </div>

          <fieldset className="invoice-advance">
            <legend>Pay now (advance)</legend>
            <label className="invoice-radio">
              <input
                type="radio"
                name="advance"
                checked={advanceMode === "full"}
                onChange={() => setAdvanceMode("full")}
              />
              Full amount
            </label>
            <label className="invoice-radio">
              <input
                type="radio"
                name="advance"
                checked={advanceMode === "percent"}
                onChange={() => setAdvanceMode("percent")}
              />
              Deposit %
            </label>
            {advanceMode === "percent" && (
              <input
                className="input"
                type="number"
                min="1"
                max="100"
                step="1"
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                placeholder="50"
                aria-label="Deposit percent"
              />
            )}
            <label className="invoice-radio">
              <input
                type="radio"
                name="advance"
                checked={advanceMode === "amount"}
                onChange={() => setAdvanceMode("amount")}
              />
              Deposit ₦
            </label>
            {advanceMode === "amount" && (
              <input
                className="input"
                type="number"
                min="1"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="25000"
                aria-label="Deposit amount naira"
              />
            )}
          </fieldset>

          {preview && (
            <div className="invoice-preview muted">
              <div>Items: {formatNaira(preview.subtotalKobo)}</div>
              {preview.deliveryKobo > 0 && (
                <div>Delivery: {formatNaira(preview.deliveryKobo)}</div>
              )}
              <div>Invoice total: {formatNaira(preview.totalKobo)}</div>
              <div>Due now (Paystack): {formatNaira(preview.chargeKobo)}</div>
              <div>
                Remaining after payment: {formatNaira(preview.remainingKobo)}
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn"
            disabled={busy || !preview}
            onClick={() => void createInvoice()}
          >
            {busy ? "Sending…" : "Create invoice & send link"}
          </button>
          {error && <p className="invoice-error">{error}</p>}
          {ok && <p className="invoice-ok">{ok}</p>}

          {items.length > 0 && (
            <div className="invoice-history">
              <h4>Recent</h4>
              {items.slice(0, 3).map((bundle) => {
                const quoteTotal = bundle.quotes[0]?.totalKobo ?? 0;
                const paid = bundle.payments
                  .filter((p) => p.status === "paid")
                  .reduce((s, p) => s + p.amountKobo, 0);
                const remaining = Math.max(0, quoteTotal - paid);
                return (
                  <div key={bundle.order.id} className="muted">
                    <strong>{bundle.order.ref}</strong> · {bundle.order.stage}
                    {quoteTotal > 0 && (
                      <div>
                        Total {formatNaira(quoteTotal)} · remaining{" "}
                        {formatNaira(remaining)}
                      </div>
                    )}
                    {bundle.payments.slice(0, 2).map((p) => (
                      <div key={p.id}>
                        {p.kind}: {formatNaira(p.amountKobo)} · {p.status}
                        {p.authorizationUrl && p.status !== "paid" && (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={p.authorizationUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              open link
                            </a>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
