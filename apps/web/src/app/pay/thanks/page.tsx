"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MarketingShell } from "@/components/landing/MarketingShell";

type Receipt = {
  reference: string;
  status: string;
  kind: string;
  order_ref: string | null;
  quote_ref: string | null;
  description: string | null;
  paid_kobo: number;
  invoice_total_kobo: number;
  remaining_kobo: number;
  paid_at: string | null;
  channel: string | null;
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function PayThanksInner() {
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(reference));

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pay/receipt?reference=${encodeURIComponent(reference)}`,
        );
        const json = (await res.json()) as Receipt & {
          error?: { message?: string };
        };
        if (!res.ok) {
          throw new Error(json.error?.message ?? "Could not load receipt");
        }
        if (!cancelled) setReceipt(json);
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    // Webhook may lag a few seconds behind the redirect.
    const t = setInterval(() => void load(), 4000);
    const stop = setTimeout(() => clearInterval(t), 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [reference]);

  return (
    <div className="mkt-auth-card">
      <h1>Payment {receipt?.status === "paid" ? "received" : "processing"}</h1>
      {!reference && (
        <p className="mkt-auth-lead" style={{ marginTop: "0.75rem" }}>
          Thank you. Your seller will confirm on WhatsApp shortly.
        </p>
      )}
      {loading && (
        <p className="mkt-auth-lead" style={{ marginTop: "0.75rem" }}>
          Loading receipt…
        </p>
      )}
      {error && (
        <p className="mkt-error" style={{ marginTop: "0.75rem" }}>
          {error}
        </p>
      )}
      {receipt && (
        <div className="mkt-pay-receipt">
          {receipt.description && (
            <p className="mkt-auth-lead">{receipt.description}</p>
          )}
          <dl>
            {receipt.order_ref && (
              <>
                <dt>Order</dt>
                <dd>{receipt.order_ref}</dd>
              </>
            )}
            {receipt.quote_ref && (
              <>
                <dt>Invoice</dt>
                <dd>{receipt.quote_ref}</dd>
              </>
            )}
            <dt>
              {receipt.kind === "deposit"
                ? "Deposit paid"
                : receipt.kind === "balance"
                  ? "Balance paid"
                  : "Amount paid"}
            </dt>
            <dd>{formatNaira(receipt.paid_kobo)}</dd>
            <dt>Invoice total</dt>
            <dd>{formatNaira(receipt.invoice_total_kobo)}</dd>
            <dt>Remaining to pay</dt>
            <dd>
              {receipt.remaining_kobo > 0
                ? formatNaira(receipt.remaining_kobo)
                : `${formatNaira(0)} — fully paid`}
            </dd>
            <dt>Reference</dt>
            <dd>
              <code>{receipt.reference}</code>
            </dd>
            <dt>Status</dt>
            <dd>{receipt.status}</dd>
          </dl>
          <p className="mkt-auth-lead">
            A confirmation is also sent on WhatsApp when the payment is
            verified.
          </p>
        </div>
      )}
    </div>
  );
}

export default function PayThanksPage() {
  return (
    <MarketingShell variant="compact" mainClassName="mkt-page--pay">
      <Suspense
        fallback={
          <div className="mkt-auth-card">
            <h1>Payment received</h1>
            <p className="mkt-auth-lead" style={{ marginTop: "0.75rem" }}>
              Loading…
            </p>
          </div>
        }
      >
        <PayThanksInner />
      </Suspense>
    </MarketingShell>
  );
}
