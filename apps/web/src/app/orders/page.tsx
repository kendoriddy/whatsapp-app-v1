"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Order = { id: string; ref: string; stage: string; riskLevel: string };

export default function OrdersPage() {
  const [items, setItems] = useState<Order[]>([]);
  useEffect(() => {
    api<{ items: Order[] }>("/api/orders").then((r) => setItems(r.items)).catch(console.error);
  }, []);
  return (
    <div>
      <h1>Orders</h1>
      <div className="panel" style={{ marginTop: "1rem" }}>
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Stage</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td>{o.ref}</td>
                <td>{o.stage}</td>
                <td>{o.riskLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="muted">No orders. Enable orders.module and create from a conversation.</p>}
      </div>
    </div>
  );
}
