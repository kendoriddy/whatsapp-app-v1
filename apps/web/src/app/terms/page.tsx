import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · MMABON Order Desk",
  description: "Terms of use for the MMABON WhatsApp Order Desk",
};

export default function TermsPage() {
  return (
    <article className="panel" style={{ maxWidth: "42rem", lineHeight: 1.55 }}>
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: 22 October 2026 · Pilot / staging</p>

      <p>
        These terms cover use of the <strong>MMABON Order Desk</strong> Meta
        application and related WhatsApp Cloud API integration operated for
        MMABON Custom &amp; Retail.
      </p>

      <h2>Service</h2>
      <p>
        The Service provides a staff dashboard to receive WhatsApp messages sent
        to MMABON’s registered Cloud API number(s), store them, and send
        staff-approved replies and templates. It is not a consumer-facing
        chatbot and does not replace WhatsApp’s own consumer terms.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>
          Only authorised MMABON staff and contracted developers may use the
          dashboard
        </li>
        <li>
          Outbound customer messages must follow WhatsApp Business policies and
          MMABON’s approval rules
        </li>
        <li>
          Do not attempt to bypass authentication, scrape, or abuse Meta’s APIs
        </li>
        <li>
          Do not use the Service for unlawful, deceptive, or spam messaging
        </li>
      </ul>

      <h2>Accounts</h2>
      <p>
        Staff accounts are invite-only. You must keep credentials confidential
        and tell an admin if access should be revoked.
      </p>

      <h2>Third parties</h2>
      <p>
        The Service depends on Meta (WhatsApp Cloud API), hosting providers, and
        optionally Paystack and AI providers. Their terms apply to their
        portions of the stack.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The pilot is provided “as is”. We aim for reliability but do not
        guarantee uninterrupted delivery of WhatsApp messages, which also
        depends on Meta’s platform.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:privacy@mmabon.ng">privacy@mmabon.ng</a> (or
        the Meta app contact email on file).
      </p>
    </article>
  );
}
