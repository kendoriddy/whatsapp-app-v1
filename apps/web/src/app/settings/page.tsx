"use client";

import Link from "next/link";

const cards = [
  {
    href: "/settings/merlin",
    title: "Merlin",
    body: "Auto-reply toggle and knowledge bank documents Merlin reads before answering customers.",
  },
  {
    href: "/settings/whatsapp",
    title: "WhatsApp",
    body: "Connected numbers, token health, and Meta sync.",
  },
  {
    href: "/settings/flags",
    title: "Feature flags",
    body: "Module switches (orders, payments, AI steps, send pause).",
  },
];

export default function SettingsHomePage() {
  return (
    <div>
      <h1>Settings</h1>
      <p className="muted">Admin controls for Relay.</p>
      <div className="grid-cards" style={{ marginTop: "1rem" }}>
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="panel card-stat card-stat-link"
          >
            <h3>{c.title}</h3>
            <p
              style={{
                fontSize: "0.9rem",
                fontWeight: 400,
                marginTop: "0.5rem",
              }}
            >
              {c.body}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
