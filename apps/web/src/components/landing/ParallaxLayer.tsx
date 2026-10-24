"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  speed?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Scroll-linked translateY. Disabled when prefers-reduced-motion. */
export function ParallaxLayer({
  speed = 0.25,
  className = "",
  style,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    setActive(true);
    let raf = 0;
    function tick() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const viewMid = window.innerHeight / 2;
      setOffset((mid - viewMid) * -speed);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    function onMq() {
      if (mq.matches) {
        setActive(false);
        setOffset(0);
      } else {
        setActive(true);
        tick();
      }
    }
    mq.addEventListener("change", onMq);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mq.removeEventListener("change", onMq);
    };
  }, [speed]);

  return (
    <div
      ref={ref}
      className={`parallax-layer ${className}`.trim()}
      style={{
        ...style,
        transform: active ? `translate3d(0, ${offset}px, 0)` : undefined,
      }}
    >
      {children}
    </div>
  );
}
