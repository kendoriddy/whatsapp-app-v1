"use client";

import { useState } from "react";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Do my customers need a new number?",
    a: "No. They keep messaging your existing WhatsApp Business number. Relay connects that number so your whole team can reply from one desk.",
  },
  {
    q: "Is this the official WhatsApp API?",
    a: "Yes. Relay uses Meta’s official WhatsApp Cloud API (Business Platform)—not the personal WhatsApp app or unofficial scrapers. Your number is registered for Cloud API on your WhatsApp Business Account.",
  },
  {
    q: "How do payments work?",
    a: "You send a Paystack payment link from the conversation. When the customer pays, Relay updates the order status automatically so the team can see Paid without chasing screenshots.",
  },
  {
    q: "Who is Merlin?",
    a: "Merlin is Relay’s AI assistant. It summarises long chats so anyone on your team can pick up mid-sale without reading hundreds of messages.",
  },
  {
    q: "Can I try it first?",
    a: "Yes — start free. You can connect your number and invite staff before you commit to a paid plan.",
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="landing-faq">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`landing-faq-item ${isOpen ? "open" : ""}`}
          >
            <button
              type="button"
              className="landing-faq-q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.q}</span>
              <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && <div className="landing-faq-a">{item.a}</div>}
          </div>
        );
      })}
    </div>
  );
}
