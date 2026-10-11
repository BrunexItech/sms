"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "ssr" | "armed" | "in";

/**
 * Scroll-in animation. Content is visible by default (SSR / no JS); it is only
 * hidden once mounted *and* known to be below the fold, then revealed on entry.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("ssr");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      setPhase("in");
      return;
    }
    setPhase("armed");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setPhase("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls =
    phase === "armed" ? "reveal" : phase === "in" ? "reveal is-in" : "";
  return (
    <div
      ref={ref}
      className={`${cls} ${className}`}
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
