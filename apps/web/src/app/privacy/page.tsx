import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · MMABON Order Desk",
  description: "Privacy notice for the MMABON WhatsApp Order Desk",
};

export default function PrivacyPage() {
  return (
    <article className="panel" style={{ maxWidth: "42rem", lineHeight: 1.55 }}>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 22 October 2026 · Pilot / staging</p>

      <p>
        This notice covers the <strong>MMABON Order Desk</strong> (the
        “Service”), a staff tool that receives and sends WhatsApp Business
        messages for MMABON Custom &amp; Retail via Meta’s WhatsApp Cloud API.
      </p>

      <h2>Who we are</h2>
      <p>
        <strong>Data controller:</strong> MMABON Custom &amp; Retail (Nigeria).
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
          Order and payment records created by staff (including Paystack
          references when enabled)
        </li>
      </ul>

      <h2>Why we process it</h2>
      <p>
        To operate a shared WhatsApp inbox, fulfil custom-apparel orders, send
        staff-approved replies and payment links, and improve classification of
        enquiries. Processing is based on legitimate interests in serving
        customers who message the business, and contract performance where an
        order exists.
      </p>

      <h2>Where data is stored</h2>
      <p>
        Application data is stored in our hosting and database providers (for
        example Vercel and Supabase). During the pilot, infrastructure may be
        outside Nigeria; we will disclose cross-border transfers as required
        under the Nigeria Data Protection Act 2023 (NDPA).
      </p>

      <h2>Retention</h2>
      <p>
        Messages and orders are kept for the pilot unless MMABON sets a shorter
        retention period. Webhook forensics and some AI run inputs are purged on
        shorter schedules described in our internal operations runbook.
      </p>

      <h2>Your rights</h2>
      <p>
        Customers and staff may request access, correction, or deletion of
        personal data by contacting the controller. Staff admins can export or
        anonymise a contact’s data from the Service when that feature is
        enabled.
      </p>

      <h2>Meta / WhatsApp</h2>
      <p>
        Messaging also follows Meta’s WhatsApp Business terms and Meta’s privacy
        policy. We do not sell personal data.
      </p>
    </article>
  );
}
