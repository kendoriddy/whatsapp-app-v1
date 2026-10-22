"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Summary = {
  open_conversations: number;
  inbound_7d: number;
  pending_approvals: number;
  classification_needs_review: number;
};

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    api<Summary>("/api/dashboard/summary").then(setS).catch(console.error);
  }, []);
  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid-cards" style={{ marginTop: "1rem" }}>
        {[
          ["Open chats", s?.open_conversations],
          ["Inbound (7d)", s?.inbound_7d],
          ["Pending approvals", s?.pending_approvals],
          ["AI needs review", s?.classification_needs_review],
        ].map(([label, val]) => (
          <div className="panel card-stat" key={String(label)}>
            <h3>{label}</h3>
            <p>{val ?? "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
