import { ImageResponse } from "next/og";

/** Node runtime — next/og exceeds Vercel’s 1 MB Edge Function limit. */
export const runtime = "nodejs";
export const alt = "Relay — Sell on WhatsApp. Run it like a desk.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#0a100c",
        color: "#e8efe6",
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#c4a35a",
          fontSize: 42,
          fontWeight: 700,
        }}
      >
        Relay
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          Sell on WhatsApp. Run it like a desk.
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#b8c9b8",
            maxWidth: 820,
            lineHeight: 1.4,
          }}
        >
          Shared inbox · Orders · Paystack — so no sale gets lost on one phone.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            flex: 1,
            background: "#1a221c",
            border: "1px solid #2e3b32",
            borderRadius: 16,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontSize: 18,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ color: "#9aab9a", fontSize: 14 }}>Customer</div>
          <div>Abeg how much for the 3-tier cake for Saturday?</div>
          <div style={{ color: "#9aab9a", fontSize: 14, marginTop: 8 }}>
            Ada · Sales
          </div>
          <div style={{ background: "#1f4d36", borderRadius: 10, padding: 12 }}>
            ₦85,000 — I&apos;ll send the Paystack link now.
          </div>
        </div>
        <div
          style={{
            width: 280,
            background: "#243028",
            border: "1px solid #2e3b32",
            borderRadius: 16,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontWeight: 700 }}>Order</div>
          <div>3-tier cake · ₦85,000</div>
          <div style={{ color: "#c4a35a" }}>Due Sat</div>
          <div
            style={{
              marginTop: "auto",
              color: "#7dcea0",
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            Paid ✓
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
