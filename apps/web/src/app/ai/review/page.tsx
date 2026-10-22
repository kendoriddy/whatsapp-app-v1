export default function AiReviewPage() {
  return (
    <div>
      <h1>AI review</h1>
      <p className="muted">Messages with classification_needs_review and no override.</p>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <p className="muted">Queue empty.</p>
      </div>
    </div>
  );
}
