"use client";

import { useEffect, useRef, useState } from "react";

const FINAL = "10 shirts · 3 colours · N15,000";
const GLYPHS = "&%^{*/}#@$!~[]<>|;:?+=_";

type Props = {
  className?: string;
};

export function ScrambleText({ className = "mkt-scramble" }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [text, setText] = useState(FINAL);
  const ran = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || ran.current) return;
        ran.current = true;
        const duration = 1200;
        const start = performance.now();

        function frame(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const reveal = Math.floor(t * FINAL.length);
          let out = "";
          for (let i = 0; i < FINAL.length; i++) {
            if (i < reveal || FINAL[i] === " ") {
              out += FINAL[i];
            } else {
              out += GLYPHS[(i + Math.floor(now / 40)) % GLYPHS.length];
            }
          }
          setText(out);
          if (t < 1) {
            raf = requestAnimationFrame(frame);
          } else {
            setText(FINAL);
          }
        }
        raf = requestAnimationFrame(frame);
        io.disconnect();
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <p ref={ref} className={className} aria-live="polite">
      {text}
    </p>
  );
}
