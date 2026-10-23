import Link from "next/link";
import type { Metadata } from "next";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — WhatsApp order desk for selling teams`,
  description: PRODUCT_TAGLINE,
};

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-hero-media" aria-hidden="true" />
        <div className="landing-hero-veil" aria-hidden="true" />

        <header className="landing-top">
          <span className="landing-logo">{PRODUCT_NAME}</span>
          <Link href="/login" className="landing-top-link">
            Staff sign in
          </Link>
        </header>

        <div className="landing-hero-copy">
          <p className="landing-brand-mark">{PRODUCT_NAME}</p>
          <h1 className="landing-headline">
            Sell on WhatsApp.
            <br />
            Run it like a desk.
          </h1>
          <p className="landing-lede">{PRODUCT_TAGLINE}</p>
          <div className="landing-cta">
            <Link href="/login" className="landing-cta-primary">
              Open the desk
            </Link>
            <a href="#how" className="landing-cta-secondary">
              How it works
            </a>
          </div>
        </div>
      </div>

      <section id="how" className="landing-section">
        <h2>One number. Your whole team.</h2>
        <p>
          Customers already message you on WhatsApp. {PRODUCT_NAME} turns that
          thread into a shared inbox, staff replies, orders, and payments —
          without the chat living on one person&apos;s phone.
        </p>
      </section>

      <section className="landing-section landing-section-alt">
        <h2>Built for custom orders</h2>
        <p>
          Briefs, quotes, and Paystack links stay attached to the conversation.
          Merlin summarizes long threads so anyone can pick up mid-sale.
        </p>
      </section>

      <footer className="landing-foot">
        <span>{PRODUCT_NAME}</span>
        <nav>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}
