import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of use for ${PRODUCT_NAME}`,
};

export default function TermsPage() {
  return (
    <article
      className="panel"
      style={{ maxWidth: "42rem", lineHeight: 1.55, margin: "1.5rem auto" }}
    >
      <p>
        <Link href="/" className="muted">
          ← {PRODUCT_NAME}
        </Link>
      </p>
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: 23 October 2026 · Pilot / staging</p>

      <p>
        These terms cover use of <strong>{PRODUCT_NAME}</strong>, a Meta
        application and WhatsApp Cloud API integration that powers a staff order
        desk for the business operating this deployment (pilot workspace: MMABON
        Custom &amp; Retail).
      </p>

      <h2>Service</h2>
      <p>
        The Service provides a staff dashboard to receive WhatsApp messages sent
        to the business’s registered Cloud API number(s), store them, and send
        staff-approved replies and templates. It is not a consumer-facing
        chatbot and does not replace WhatsApp’s own consumer terms.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>
          Only authorised staff of the operating business and contracted
          developers may use the dashboard
        </li>
        <li>
          Outbound customer messages must follow WhatsApp Business policies and
          the business’s approval rules
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
