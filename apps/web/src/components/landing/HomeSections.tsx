import Link from "next/link";
import { ParallaxLayer } from "./ParallaxLayer";
import {
  InboxPhoneMock,
  MerlinLaptopMock,
  NumberPhoneMock,
  OrderDesktopMock,
  PaystackPhoneMock,
  ScramblePhoneMock,
  TeamPhoneOverlay,
} from "./DeviceFrames";

export function HeroSection() {
  return (
    <section className="mkt-hero" aria-labelledby="hero-heading">
      <div className="mkt-hero-card">
        {/* Swap hero-seller.svg → hero-seller.jpg when the photo is ready */}
        <div
          className="mkt-hero-photo"
          role="img"
          aria-label="Seller packing an order while checking their phone"
        />
        <div className="mkt-hero-copy">
          <h1 id="hero-heading" className="landing-h">
            Sell in chat, together
          </h1>
          <p className="landing-body">
            Relay is the WhatsApp order desk for teams that sell in chat. Your
            whole team replies from one number, and customers pay on Paystack.
          </p>
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Get started ↓
          </Link>
        </div>
        <div className="mkt-hero-chips" aria-hidden="true">
          <ParallaxLayer
            speed={0.35}
            className="mkt-chip mkt-chip-in mkt-chip-a"
          >
            Kenny: Can I get 10 shirts in 3 colours?
          </ParallaxLayer>
          <ParallaxLayer
            speed={0.45}
            className="mkt-chip mkt-chip-out mkt-chip-b"
          >
            Yes! N15,000 for all 10
          </ParallaxLayer>
          <ParallaxLayer
            speed={0.28}
            className="mkt-chip mkt-chip-merlin mkt-chip-c"
          >
            Merlin · Summary ready
          </ParallaxLayer>
          <ParallaxLayer
            speed={0.4}
            className="mkt-chip mkt-chip-status mkt-chip-d"
          >
            Deposit paid · Paystack
          </ParallaxLayer>
        </div>
      </div>
    </section>
  );
}

export function MerlinSection() {
  return (
    <section
      className="mkt-section"
      id="merlin"
      aria-labelledby="merlin-heading"
    >
      <div className="mkt-split visual-left">
        <div className="mkt-split-visual">
          <MerlinLaptopMock />
        </div>
        <div className="mkt-split-copy">
          <h2 id="merlin-heading" className="landing-h">
            New! Meet Merlin
          </h2>
          <p className="landing-body">
            Merlin reads the whole chat and gives you the order in seconds:
            items, colours, price and delivery date. It drafts the reply and the
            invoice. A person always checks and presses send.
          </p>
          <a href="#control" className="landing-link">
            Learn more ›
          </a>
        </div>
      </div>
    </section>
  );
}

const avatarLayout: {
  src: string;
  top: string;
  left: string;
  size: number;
  speed: number;
  blur?: boolean;
}[] = [
  {
    src: "/landing/avatar-1.svg",
    top: "8%",
    left: "6%",
    size: 64,
    speed: 0.12,
    blur: true,
  },
  {
    src: "/landing/avatar-2.svg",
    top: "12%",
    left: "78%",
    size: 72,
    speed: 0.2,
  },
  {
    src: "/landing/avatar-3.svg",
    top: "22%",
    left: "18%",
    size: 48,
    speed: 0.3,
  },
  {
    src: "/landing/avatar-4.svg",
    top: "18%",
    left: "55%",
    size: 56,
    speed: 0.15,
    blur: true,
  },
  {
    src: "/landing/avatar-5.svg",
    top: "55%",
    left: "4%",
    size: 70,
    speed: 0.22,
  },
  {
    src: "/landing/avatar-6.svg",
    top: "62%",
    left: "88%",
    size: 52,
    speed: 0.18,
  },
  {
    src: "/landing/avatar-7.svg",
    top: "70%",
    left: "22%",
    size: 60,
    speed: 0.28,
  },
  {
    src: "/landing/avatar-8.svg",
    top: "75%",
    left: "68%",
    size: 44,
    speed: 0.14,
    blur: true,
  },
  {
    src: "/landing/avatar-9.svg",
    top: "38%",
    left: "90%",
    size: 58,
    speed: 0.25,
  },
  {
    src: "/landing/avatar-10.svg",
    top: "42%",
    left: "2%",
    size: 40,
    speed: 0.32,
  },
  {
    src: "/landing/avatar-11.svg",
    top: "5%",
    left: "42%",
    size: 50,
    speed: 0.1,
    blur: true,
  },
  {
    src: "/landing/avatar-12.svg",
    top: "80%",
    left: "48%",
    size: 66,
    speed: 0.2,
  },
];

export function StatementSection() {
  return (
    <section className="mkt-statement" aria-labelledby="statement-heading">
      <div className="mkt-avatars" aria-hidden="true">
        {avatarLayout.map((a, i) => (
          <ParallaxLayer
            key={a.src}
            speed={a.speed}
            style={{
              position: "absolute",
              top: a.top,
              left: a.left,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.src}
              alt=""
              width={a.size}
              height={a.size}
              className={`mkt-avatar${a.blur ? " blur" : ""}`}
              style={{ width: a.size, height: a.size }}
              loading="lazy"
            />
          </ParallaxLayer>
        ))}
        <ParallaxLayer
          speed={0.35}
          style={{ position: "absolute", top: "28%", left: "72%" }}
        >
          <span className="mkt-mini-chip">Order ready</span>
        </ParallaxLayer>
        <ParallaxLayer
          speed={0.4}
          style={{ position: "absolute", top: "58%", left: "12%" }}
        >
          <span className="mkt-mini-chip accent">Paid</span>
        </ParallaxLayer>
      </div>
      <p id="statement-heading" className="mkt-statement-text">
        With Relay, your whole team can answer every customer, keep track of
        every order and get paid, all from the WhatsApp number your customers
        already know.
      </p>
    </section>
  );
}

export function InboxSection() {
  return (
    <section className="mkt-section" id="inbox" aria-labelledby="inbox-heading">
      <div className="mkt-split visual-right">
        <div className="mkt-split-copy">
          <h2 id="inbox-heading" className="landing-h">
            Never miss a customer
          </h2>
          <p className="landing-body">
            On a normal phone, only the person holding it can reply. If
            they&apos;re busy or sick, sales wait. With Relay, anyone on the
            team can pick up the chat.
          </p>
          <a href="#orders" className="landing-link">
            Learn more ›
          </a>
        </div>
        <div className="mkt-split-visual">
          <InboxPhoneMock />
        </div>
      </div>
    </section>
  );
}

export function OrdersSection() {
  return (
    <section
      className="mkt-section"
      id="orders"
      aria-labelledby="orders-heading"
    >
      <div className="mkt-split visual-left">
        <div className="mkt-split-visual">
          <OrderDesktopMock />
        </div>
        <div className="mkt-split-copy">
          <h2 id="orders-heading" className="landing-h">
            Every order, tied to its chat
          </h2>
          <p className="landing-body">
            Turn a conversation into an order with items, price and delivery
            date, and keep the full history in one place.
          </p>
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Get started ↓
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ControlSection() {
  return (
    <section
      className="mkt-dark"
      id="control"
      aria-labelledby="control-heading"
    >
      <div className="mkt-split visual-left">
        <div className="mkt-split-visual">
          <ScramblePhoneMock />
        </div>
        <div className="mkt-split-copy">
          <h2 id="control-heading" className="landing-h">
            Merlin helps.
            <br />
            <span className="accent">A person sends.</span>
          </h2>
          <p className="landing-body">
            Merlin summarises long chats and drafts replies and invoices, but it
            never messages a customer or confirms an order on its own. Your team
            stays in control.
          </p>
          <a href="#paystack" className="landing-link">
            Learn more ›
          </a>
        </div>
      </div>
    </section>
  );
}

export function PaystackSection() {
  return (
    <section
      className="mkt-section"
      id="paystack"
      aria-labelledby="paystack-heading"
    >
      <div className="mkt-split visual-right">
        <div className="mkt-split-copy">
          <h2 id="paystack-heading" className="landing-h">
            Get paid on Paystack
          </h2>
          <p className="landing-body">
            Send an invoice with a Paystack link straight from the chat. When
            the customer pays, the order updates. No screenshots, no guessing.
          </p>
          <a href="#team" className="landing-link">
            Learn more ›
          </a>
        </div>
        <div className="mkt-split-visual">
          <PaystackPhoneMock />
          <ParallaxLayer speed={0.3} className="mkt-sticker mkt-sticker-a">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/sticker-receipt.svg"
              alt=""
              width={56}
              height={56}
              loading="lazy"
            />
          </ParallaxLayer>
          <ParallaxLayer speed={0.4} className="mkt-sticker mkt-sticker-b">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/sticker-naira.svg"
              alt=""
              width={56}
              height={56}
              loading="lazy"
            />
          </ParallaxLayer>
          <ParallaxLayer speed={0.25} className="mkt-sticker mkt-sticker-c">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/sticker-check.svg"
              alt=""
              width={44}
              height={44}
              loading="lazy"
            />
          </ParallaxLayer>
        </div>
      </div>
    </section>
  );
}

export function TeamSection() {
  return (
    <section className="mkt-section" id="team" aria-labelledby="team-heading">
      <div className="mkt-split visual-left">
        <div className="mkt-split-visual">
          {/* Swap team.svg → team.jpg when the photo is ready */}
          <div
            className="mkt-team-photo"
            role="img"
            aria-label="Team working together on orders"
          >
            <TeamPhoneOverlay />
          </div>
        </div>
        <div className="mkt-split-copy">
          <h2 id="team-heading" className="landing-h">
            Built for the whole team
          </h2>
          <p className="landing-body">
            Owners, sales staff and managers work from the same desk. Everyone
            sees who replied and what was agreed.
          </p>
        </div>
      </div>
    </section>
  );
}

export function NumberSection() {
  return (
    <section
      className="mkt-section"
      id="number"
      aria-labelledby="number-heading"
    >
      <div className="mkt-split visual-right">
        <div className="mkt-split-copy">
          <h2 id="number-heading" className="landing-h">
            Works with your number
          </h2>
          <p className="landing-body">
            Customers keep messaging the WhatsApp Business number they already
            know. Nothing changes for them.
          </p>
          <Link href="/signup" className="landing-btn landing-btn-primary">
            Get started ↓
          </Link>
        </div>
        <div className="mkt-split-visual">
          <NumberPhoneMock />
        </div>
      </div>
    </section>
  );
}
