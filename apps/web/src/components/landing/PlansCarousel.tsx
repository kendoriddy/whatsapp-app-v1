"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const cards = [
  {
    title: "Starter",
    price: "N15,000 / month",
    body: "For small teams getting started",
    cta: "Get started",
    href: "/signup",
  },
  {
    title: "Team",
    price: "N35,000 / month",
    body: "For growing sales teams",
    cta: "Get started",
    href: "/signup",
  },
  {
    title: "Business",
    price: "Contact us",
    body: "For larger teams",
    cta: "Talk to us",
    href: "mailto:hello@getrelay.app",
  },
  {
    title: "Coming soon",
    price: "Follow-up reminders",
    body: "Never forget a customer who went quiet",
    cta: "Get started",
    href: "/signup",
  },
  {
    title: "Coming soon",
    price: "Approve before sending",
    body: "A manager signs off before anything goes out",
    cta: "Get started",
    href: "/signup",
  },
] as const;

export function PlansCarousel() {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(312);
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; i: number } | null>(null);

  const maxIndex = cards.length - 1;

  const measure = useCallback(() => {
    const card = trackRef.current?.querySelector(".mkt-plan-card");
    if (!(card instanceof HTMLElement)) return;
    const styles = getComputedStyle(trackRef.current!);
    const gap = parseFloat(styles.gap || "16") || 16;
    setStep(card.offsetWidth + gap);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => Math.min(maxIndex, Math.max(0, i + dir)));
    },
    [maxIndex],
  );

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    }
    vp.addEventListener("keydown", onKey);
    return () => vp.removeEventListener("keydown", onKey);
  }, [go]);

  function onPointerDown(e: ReactPointerEvent) {
    pointer.current = { x: e.clientX, i: index };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (!pointer.current) return;
    const dx = e.clientX - pointer.current.x;
    if (dx < -40) go(1);
    else if (dx > 40) go(-1);
    pointer.current = null;
  }

  return (
    <section className="mkt-mint" id="plans" aria-labelledby="plans-heading">
      <div className="mkt-mint-inner">
        <div>
          <h2 id="plans-heading" className="landing-h">
            Plans that grow with you
          </h2>
          <p className="landing-body">
            Simple monthly plans for Nigerian selling teams. Start small, grow
            when the desk is busy.
          </p>
          <div className="mkt-mint-controls">
            <button
              type="button"
              className="mkt-arrow"
              aria-label="Previous plan"
              disabled={index === 0}
              onClick={() => go(-1)}
            >
              ←
            </button>
            <button
              type="button"
              className="mkt-arrow"
              aria-label="Next plan"
              disabled={index >= maxIndex}
              onClick={() => go(1)}
            >
              →
            </button>
          </div>
        </div>

        <div
          className="mkt-carousel-viewport"
          ref={viewportRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Pricing plans"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div
            className="mkt-carousel-track"
            ref={trackRef}
            style={{ transform: `translateX(-${index * step}px)` }}
          >
            {cards.map((card, i) => (
              <article
                key={`${card.title}-${i}`}
                className="mkt-plan-card"
                aria-hidden={i < index || i > index + 2}
              >
                <h3>{card.title}</h3>
                <p className="mkt-plan-price">{card.price}</p>
                <p>{card.body}</p>
                {card.href.startsWith("mailto:") ? (
                  <a
                    href={card.href}
                    className="landing-btn landing-btn-outline"
                  >
                    {card.cta} ›
                  </a>
                ) : (
                  <Link
                    href={card.href}
                    className="landing-btn landing-btn-primary"
                  >
                    {card.cta} ↓
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
