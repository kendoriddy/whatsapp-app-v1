"use client";

import { useCallback, useEffect, useState } from "react";
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

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
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

  async function createInvoice() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const amount = Number(amountNaira);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a positive amount in naira");
      }
      const res = await api<{
        order: { ref: string };
        payment: { status: string; authorizationUrl: string | null };
        outbound: { status: string } | null;
      }>(`/api/conversations/${conversationId}/invoice`, {
        method: "POST",
        body: JSON.stringify({
          description: description.trim() || "Order",
          amount_naira: amount,
          delivery_naira: Number(deliveryNaira) || 0,
          payment_kind: "full",
        }),
      });
      setOk(
        `Invoice ${res.order.ref} created · link ${res.outbound?.status ?? res.payment.status}`,
      );
      setDescription("");
      setAmountNaira("");
      setDeliveryNaira("");
      await load();
      onSent?.();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const latestPay = items[0]?.payments[0];

  return (
    <div className="invoice-panel">
      <button
        type="button"
        className="btn secondary"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide invoice" : "Create invoice"}
      </button>

      {latestPay && !open && (
        <span className="muted invoice-status">
          {items[0]?.order.ref}: {latestPay.status}
          {latestPay.status === "paid" ? " ✓" : ""}
        </span>
      )}

      {open && (
        <div className="invoice-form panel">
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
          <button
            type="button"
            className="btn"
            disabled={busy || !amountNaira}
            onClick={() => void createInvoice()}
          >
            {busy ? "Sending…" : "Create invoice & send link"}
          </button>
          {error && <p className="invoice-error">{error}</p>}
          {ok && <p className="invoice-ok">{ok}</p>}

          {items.length > 0 && (
            <div className="invoice-history">
              <h4>Recent</h4>
              {items.slice(0, 3).map((bundle) => (
                <div key={bundle.order.id} className="muted">
                  <strong>{bundle.order.ref}</strong> · {bundle.order.stage}
                  {bundle.payments.slice(0, 2).map((p) => (
                    <div key={p.id}>
                      {formatNaira(p.amountKobo)} · {p.status}
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
