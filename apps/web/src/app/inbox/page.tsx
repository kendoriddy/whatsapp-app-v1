"use client";

import { ConversationList } from "@/components/ConversationList";

export default function InboxPage() {
  return (
    <div>
      <h1>Inbox</h1>
      <p className="muted">Shared WhatsApp conversations</p>
      <div style={{ marginTop: "1rem" }}>
        <ConversationList />
      </div>
    </div>
  );
}
