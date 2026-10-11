"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Two jobs: reset the scroll position whenever the route changes, and offer a
 * floating back-to-top button whose ring fills as the visitor scrolls.
 */
export function ScrollToTop() {
  const path = usePathname();
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);

  // New page: always start at the top (unless the URL targets an anchor).
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [path]);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
      setShow(y > 480);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [path]);

  const R = 20;
  const C = 2 * Math.PI * R;

  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={show ? 0 : -1}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" } as ScrollToOptions);
      }}
      className={`fixed bottom-24 right-5 z-[55] grid h-12 w-12 place-items-center rounded-full bg-white text-forest-900 shadow-[0_10px_26px_-8px_rgba(6,45,87,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-forest-900 hover:text-white print:hidden ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke="#f5b400"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
        />
      </svg>
      <ArrowUp size={18} strokeWidth={2.4} />
    </button>
  );
}
