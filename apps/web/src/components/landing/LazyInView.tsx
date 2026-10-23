"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Renders children only after the placeholder enters the viewport (lazy mockups). */
export function LazyInView({
  children,
  minHeight = 220,
  rootMargin = "120px",
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: show ? undefined : minHeight }}>
      {show ? (
        children
      ) : (
        <div className="landing-mock-skeleton" aria-hidden="true" />
      )}
    </div>
  );
}
