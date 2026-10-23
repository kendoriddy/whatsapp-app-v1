import Link from "next/link";
import type { Metadata } from "next";
import {
  CONTACT_EMAIL,
  CONTACT_WHATSAPP_URL,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "@/lib/brand";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { LazyInView } from "@/components/landing/LazyInView";
import {
  ProductMockup,
  StepMockConnect,
  StepMockInbox,
  StepMockPay,
} from "@/components/landing/ProductMockup";
import { TestimonialsSlot } from "@/components/landing/TestimonialsSlot";

const siteUrl =
  process.env.APP_BASE_URL?.replace(/\/$/, "") ||
  "https://whatsapp-app-v1.vercel.app";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — Sell on WhatsApp. Run it like a desk.`,
  description:
    "One WhatsApp number for your whole team. Every chat, order and Paystack payment in one place — for Nigerian businesses that sell in chat.",
  openGraph: {
    title: `${PRODUCT_NAME} — Sell on WhatsApp. Run it like a desk.`,
    description:
      "Shared inbox, orders and Paystack payments for teams that sell on WhatsApp.",
    url: siteUrl,
    siteName: PRODUCT_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} — Sell on WhatsApp. Run it like a desk.`,
    description:
      "Shared inbox, orders and Paystack payments for teams that sell on WhatsApp.",
  },
};

const problems = [
  {
    title: "Chats stuck on one phone",
    body: "When that person is off, sales stop.",
    icon: "phone",
  },
  {
    title: "Orders lost in the scroll",
    body: "Details buried under 200 messages.",
    icon: "scroll",
  },
  {
    title: "Who paid? Who replied?",
    body: "No one knows until a customer complains.",
    icon: "question",
  },
] as const;

const features = [
  {
    title: "Shared inbox for the whole team",
    body: "Everyone works from the same WhatsApp number.",
  },
  {
    title: "Assign chats to staff",
    body: "See who owns the conversation — no double replies.",
  },
  {
    title: "Orders on each conversation",
    body: "Brief, quote and due date stay attached to the chat.",
  },
  {
    title: "Paystack payment links",
    body: "Paid status shows automatically when they pay.",
  },
  {
    title: "Merlin, your AI assistant",
    body: "Merlin summarises long chats so anyone can pick up mid-sale.",
  },
  {
    title: "Staff roles and activity history",
    body: "Know who did what — with an audit trail.",
  },
] as const;

const plans = [
  {
    name: "Starter",
    price: "₦15,000/month",
    popular: false,
    limits: [
      "1 WhatsApp Business number",
      "Up to 2 staff seats",
      "Shared inbox + basic order cards",
    ],
  },
  {
    name: "Team",
    price: "₦35,000/month",
    popular: true,
    limits: [
      "1 WhatsApp Business number",
      "Up to 8 staff seats",
      "Orders, Paystack links & Merlin summaries",
    ],
  },
  {
    name: "Business",
    price: "Contact us",
    popular: false,
    limits: [
      "Multiple WhatsApp numbers",
      "Unlimited staff seats",
      "Priority onboarding & custom limits",
    ],
  },
] as const;

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-logo">
            {PRODUCT_NAME}
          </Link>
          <nav className="landing-nav-links" aria-label="Primary">
            <a href="#pricing">Pricing</a>
            <Link href="/login" className="landing-nav-signin">
              Sign in
            </Link>
            <Link href="/signup" className="landing-nav-cta">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-grid landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">For teams that sell on WhatsApp</p>
            <h1 className="landing-headline">
              Sell on WhatsApp.
              <br />
              Run it like a desk.
            </h1>
            <p className="landing-sub">
              One WhatsApp number for your whole team. Every chat, order and
              Paystack payment in one place, so no sale gets lost on
              someone&apos;s phone.
            </p>
            <div className="landing-cta">
              <Link href="/signup" className="landing-btn-primary">
                Start free
              </Link>
              <a href="#how" className="landing-btn-secondary">
                See how it works
              </a>
            </div>
            <p className="landing-hero-note">
              Works with your existing WhatsApp Business number · Paystack
              payments built in
            </p>
          </div>
          <div className="landing-hero-visual">
            <ProductMockup />
          </div>
        </div>
      </section>

      <section className="landing-band" aria-label="Problems Relay solves">
        <div className="landing-grid landing-problem-grid">
          {problems.map((p) => (
            <article key={p.title} className="landing-problem-card">
              <span
                className={`landing-icon landing-icon-${p.icon}`}
                aria-hidden="true"
              />
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="landing-band">
        <div className="landing-grid">
          <h2 className="landing-h2">How it works</h2>
          <ol className="landing-steps">
            <li>
              <div className="landing-step-copy">
                <span className="landing-step-num">1</span>
                <div>
                  <h3>Connect your WhatsApp number</h3>
                  <p>Your customers keep messaging the same number.</p>
                </div>
              </div>
              <LazyInView minHeight={100}>
                <StepMockConnect />
              </LazyInView>
            </li>
            <li>
              <div className="landing-step-copy">
                <span className="landing-step-num">2</span>
                <div>
                  <h3>Your team replies from one inbox</h3>
                  <p>Assign chats, see who said what.</p>
                </div>
              </div>
              <LazyInView minHeight={100}>
                <StepMockInbox />
              </LazyInView>
            </li>
            <li>
              <div className="landing-step-copy">
                <span className="landing-step-num">3</span>
                <div>
                  <h3>Turn chats into paid orders</h3>
                  <p>
                    Add the brief and quote, send a Paystack link, and the order
                    updates when they pay.
                  </p>
                </div>
              </div>
              <LazyInView minHeight={100}>
                <StepMockPay />
              </LazyInView>
            </li>
          </ol>
        </div>
      </section>

      <section className="landing-band landing-band-tint">
        <div className="landing-grid">
          <h2 className="landing-h2">Everything your WhatsApp desk needs</h2>
          <div className="landing-feature-grid">
            {features.map((f) => (
              <article key={f.title} className="landing-feature">
                <span className="landing-feature-mark" aria-hidden="true" />
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-band">
        <div className="landing-grid landing-ba">
          <div className="landing-ba-col before">
            <h2 className="landing-h2">Before</h2>
            <p>
              One phone, missed chats, &ldquo;did you pay?&rdquo; screenshots.
            </p>
          </div>
          <div className="landing-ba-col after">
            <h2 className="landing-h2">After</h2>
            <p>One desk, every chat answered, every payment tracked.</p>
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-band landing-band-tint">
        <div className="landing-grid">
          <h2 className="landing-h2">Pricing</h2>
          <p className="landing-lead">
            Simple plans for Nigerian selling teams. Start free, upgrade when
            your desk is busy.
          </p>
          <div className="landing-pricing-grid">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`landing-plan ${plan.popular ? "popular" : ""}`}
              >
                {plan.popular && (
                  <span className="landing-plan-badge">Most popular</span>
                )}
                <h3>
                  {plan.name} · {plan.price}
                </h3>
                <ul>
                  {plan.limits.map((lim, i) => (
                    <li key={`${plan.name}-${i}`}>{lim}</li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="landing-btn-primary landing-plan-btn"
                >
                  Start free
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <TestimonialsSlot />

      <section className="landing-band">
        <div className="landing-grid">
          <div className="landing-trust">
            <span>Payments by Paystack</span>
            <span aria-hidden="true">·</span>
            <span>
              Your data stays yours: <Link href="/privacy">see Privacy</Link>
            </span>
          </div>
        </div>
      </section>

      <section
        className="landing-band landing-band-tint"
        aria-labelledby="faq-heading"
      >
        <div className="landing-grid">
          <h2 id="faq-heading" className="landing-h2">
            FAQ
          </h2>
          <FaqAccordion />
        </div>
      </section>

      <section className="landing-final">
        <div className="landing-grid">
          <h2 className="landing-h2">
            Stop running your business from one phone.
          </h2>
          <Link href="/signup" className="landing-btn-primary">
            Start free
          </Link>
          <p className="landing-hero-note">Takes about 5 minutes to set up.</p>
        </div>
      </section>

      <footer className="landing-foot">
        <div className="landing-grid landing-foot-grid">
          <div>
            <p className="landing-logo">{PRODUCT_NAME}</p>
            <p className="landing-foot-tag">{PRODUCT_TAGLINE}</p>
          </div>
          <nav className="landing-foot-nav" aria-label="Footer">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/login">Sign in</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <a href={CONTACT_WHATSAPP_URL}>WhatsApp</a>
          </nav>
          <p className="landing-disclaimer">
            Relay is not affiliated with WhatsApp or Meta.
          </p>
        </div>
      </footer>
    </div>
  );
}
