/** Code-built desk mockup — shared inbox + order + Paystack paid. */
export function ProductMockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`desk-mock ${compact ? "compact" : ""}`} aria-hidden="true">
      <div className="desk-mock-chrome">
        <span />
        <span />
        <span />
        <em>Relay · Inbox</em>
      </div>
      <div className="desk-mock-body">
        <div className="desk-mock-thread">
          <div className="desk-mock-bubble in">
            <p>Abeg how much for the 3-tier cake for Saturday?</p>
            <small>Customer · WhatsApp</small>
          </div>
          <div className="desk-mock-bubble out">
            <p>
              Yes ma — 3-tier is ₦85,000, ready by Saturday morning. I&apos;ll
              send the Paystack link now.
            </p>
            <small>Ada · Sales</small>
          </div>
        </div>
        <aside className="desk-mock-side">
          <div className="desk-mock-order">
            <strong>Order</strong>
            <p>3-tier cake · ₦85,000</p>
            <p className="desk-mock-due">Due Sat</p>
          </div>
          <div className="desk-mock-pay">
            <span>Paystack link</span>
            <strong className="desk-mock-paid">Paid ✓</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function StepMockConnect() {
  return (
    <div className="step-mock" aria-hidden="true">
      <div className="step-mock-row">
        <span className="step-mock-dot on" />
        <span>+234 816 ··· ····</span>
      </div>
      <p>WhatsApp Business · Connected</p>
    </div>
  );
}

export function StepMockInbox() {
  return (
    <div className="step-mock" aria-hidden="true">
      <div className="step-mock-chip">Ada</div>
      <div className="step-mock-chip muted">Tunde</div>
      <p>2 open chats · assigned</p>
    </div>
  );
}

export function StepMockPay() {
  return (
    <div className="step-mock" aria-hidden="true">
      <p className="step-mock-amount">₦85,000</p>
      <strong className="desk-mock-paid">Paid ✓</strong>
    </div>
  );
}
