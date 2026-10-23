import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy notice for ${PRODUCT_NAME}`,
};

export default function PrivacyPage() {
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
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 23 October 2026 · Pilot / staging</p>

      <p>
        This notice covers <strong>{PRODUCT_NAME}</strong> (the “Service”), a
        staff WhatsApp order desk that receives and sends Business messages via
        Meta’s WhatsApp Cloud API for the business that operates this
        deployment.
      </p>

      <h2>Who we are</h2>
      <p>
        <strong>Data controller:</strong> the business that connects its
        WhatsApp Business Account to this {PRODUCT_NAME} deployment (pilot:
        MMABON Custom &amp; Retail, Nigeria).
        <br />
        <strong>Contact:</strong>{" "}
        <a href="mailto:privacy@mmabon.ng">privacy@mmabon.ng</a> (or the
        business owner’s contact email used for this Meta app).
      </p>

      <h2>What we process</h2>
      <ul>
        <li>
          WhatsApp identifiers (phone numbers / wa_id) and profile names Meta
          sends us
        </li>
        <li>
          Message content and media customers or staff send on the business
          number
        </li>
        <li>Delivery statuses, templates, and related Meta webhook metadata</li>
        <li>Staff accounts (name, email, role) for the dashboard</li>
        <li>
          Order, quote, and payment metadata when those modules are enabled
        </li>
      </ul>

      <h2>Why we process it</h2>
      <p>
        To operate customer support and sales over WhatsApp: show conversations
        to authorised staff, send replies, fulfil orders, and process payments.
        Legal bases include performance of a contract with the customer and
        legitimate interests of the business in running its WhatsApp channel.
      </p>

      <h2>Sharing</h2>
      <p>
        We use Meta (WhatsApp Cloud API), hosting/database providers (e.g.
        Vercel, Supabase), and optionally payment (Paystack) and AI providers
        under their terms. We do not sell personal data.
      </p>

      <h2>Retention</h2>
      <p>
        Messages and orders are kept for the pilot unless the operating business
        sets a shorter retention period.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on applicable law (including Nigeria’s NDPA), you may request
        access, correction, or deletion. Contact the controller above.
      </p>
    </article>
  );
}
