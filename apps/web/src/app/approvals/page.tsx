export default function ApprovalsPage() {
  return (
    <div>
      <h1>Approvals</h1>
      <p className="muted">Outbound messages waiting for SEND_ROLES approval appear here.</p>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <p className="muted">Empty — no pending approvals.</p>
      </div>
    </div>
  );
}
