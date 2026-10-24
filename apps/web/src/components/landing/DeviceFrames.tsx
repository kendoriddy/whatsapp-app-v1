import type { ReactNode } from "react";
import { ScrambleText } from "./ScrambleText";

export function PhoneFrame({
  children,
  dark = false,
  inputBar,
}: {
  children: ReactNode;
  dark?: boolean;
  inputBar?: string;
}) {
  return (
    <div className={`phone-frame${dark ? " dark" : ""}`} aria-hidden="true">
      <div className="phone-screen">
        <div className="phone-notch">9:41</div>
        <div className="phone-body">
          {children}
          {inputBar ? <div className="phone-input-bar">{inputBar}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function LaptopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="laptop-frame" aria-hidden="true">
      <div className="laptop-lid">
        <div className="laptop-screen">{children}</div>
      </div>
      <div className="laptop-base" />
    </div>
  );
}

export function MerlinLaptopMock() {
  return (
    <LaptopFrame>
      <div className="laptop-desk">
        <div className="laptop-thread">
          <div className="mock-bubble in">
            Kenny: Can I get 10 shirts in 3 colours?
          </div>
          <div className="mock-bubble out">Yes! N15,000 for all 10</div>
          <div className="mock-bubble in">Delivery to Ikeja by Friday?</div>
        </div>
        <div className="laptop-side">
          <div className="mock-merlin-panel">
            <strong>Merlin</strong>
            <p style={{ margin: "0.35rem 0 0" }}>
              10 shirts · 3 colours · N15,000 · Fri delivery
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "#54656F" }}>
              Draft reply + invoice ready
            </p>
          </div>
        </div>
      </div>
    </LaptopFrame>
  );
}

export function InboxPhoneMock() {
  return (
    <PhoneFrame>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>Inbox</p>
      {[
        { name: "Kenny", preview: "10 shirts in 3 colours?", tag: "Ada" },
        { name: "Chioma", preview: "Is the cake ready?", tag: "Tunde" },
        { name: "Ibrahim", preview: "Paystack link?", tag: "Ada" },
      ].map((c) => (
        <div key={c.name} className="mock-list-item">
          <span className="mock-avatar-sm" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div
              style={{
                color: "#54656F",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.preview}
            </div>
          </div>
          <span className="mock-tag">assigned to {c.tag}</span>
        </div>
      ))}
    </PhoneFrame>
  );
}

export function OrderDesktopMock() {
  return (
    <LaptopFrame>
      <div className="laptop-desk">
        <div className="laptop-thread">
          <div className="mock-bubble in">Need 10 shirts, 3 colours</div>
          <div className="mock-bubble out">
            Order created — N15,000, due Friday
          </div>
        </div>
        <div className="laptop-side">
          <div className="mock-order-panel">
            <strong>Order</strong>
            <p style={{ margin: "0.4rem 0 0" }}>10 shirts · 3 colours</p>
            <p style={{ margin: "0.25rem 0 0" }}>N15,000 · Due Fri</p>
            <p style={{ margin: "0.5rem 0 0", color: "#54656F" }}>
              Tied to this chat
            </p>
          </div>
        </div>
      </div>
    </LaptopFrame>
  );
}

export function ScramblePhoneMock() {
  return (
    <PhoneFrame dark inputBar="Draft ready for review">
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6 }}>
        Merlin draft
      </p>
      <div className="mock-bubble in" style={{ maxWidth: "100%" }}>
        <ScrambleText />
      </div>
      <div className="mock-bubble out" style={{ opacity: 0.7 }}>
        Here&apos;s your quote — please review before send
      </div>
    </PhoneFrame>
  );
}

export function PaystackPhoneMock() {
  return (
    <PhoneFrame>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>Invoice</p>
      <div className="mock-bubble out" style={{ maxWidth: "100%" }}>
        <div>10 shirts · 3 colours</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>N15,000</div>
        <div
          style={{
            marginTop: 8,
            textDecoration: "underline",
            fontSize: "0.75rem",
          }}
        >
          pay.paystack.com/relay-demo
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span className="mock-paid">Paid ✓</span>
      </div>
    </PhoneFrame>
  );
}

export function TeamPhoneOverlay() {
  return (
    <div className="mkt-team-overlay">
      <PhoneFrame>
        <div className="mock-list-item">
          <span className="mock-avatar-sm" />
          <div>
            <div style={{ fontWeight: 600 }}>Ada replied</div>
            <div style={{ color: "#54656F", fontSize: "0.7rem" }}>
              2 min ago
            </div>
          </div>
        </div>
        <div className="mock-list-item">
          <span className="mock-avatar-sm" />
          <div>
            <div style={{ fontWeight: 600 }}>Tunde assigned</div>
            <div style={{ color: "#54656F", fontSize: "0.7rem" }}>Kenny</div>
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}

export function NumberPhoneMock() {
  return (
    <PhoneFrame>
      <p style={{ margin: 0, fontWeight: 600 }}>WhatsApp Business</p>
      <div className="mock-list-item" style={{ marginTop: 8 }}>
        <span className="mock-avatar-sm" />
        <div>
          <div style={{ fontWeight: 600 }}>+234 ··· ····</div>
          <div style={{ color: "#54656F" }}>Customers keep this number</div>
        </div>
      </div>
      <div className="mock-bubble in">Hi! Same number as always 👋</div>
      <div className="mock-bubble out">Welcome — whole team is here</div>
    </PhoneFrame>
  );
}
