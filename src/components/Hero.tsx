"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { HERO_SLIDES } from "@/data/hero-slides";

const INTERVAL = 6500;

/** Home hero: a slow, cross-fading slideshow with one slide per featured sport. */
export function Hero() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touch = useRef<number | null>(null);
  const n = HERO_SLIDES.length;
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const running = playing && !hover && !reduced;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setI((k) => (k + 1) % n), INTERVAL);
    return () => clearTimeout(t);
  }, [running, i, n]);

  const s = HERO_SLIDES[i];
  /** Signed distance of slide k from the current one, wrapped so the shortest way round is used. */
  const offset = (k: number) => ((k - i + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);

  return (
    <section
      className="relative isolate overflow-hidden bg-forest-950 text-white"
      aria-roledescription="carousel"
      aria-label="Featured sports"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        if (e.key === "ArrowLeft") go(i - 1);
      }}
    >
      {/* slides: each one glides in from the side while its photo drifts the other way (parallax) */}
      <div className="absolute inset-0 -z-20 overflow-hidden" aria-hidden>
        {HERO_SLIDES.map((h, k) => {
          const off = offset(k);
          const near = Math.abs(off) <= 1;
          return (
            <div
              key={h.sport}
              className="hero-slide absolute inset-0 overflow-hidden will-change-transform"
              style={{
                transform: `translate3d(${off * 100}%,0,0)`,
                transition: near && !reduced ? "transform 1250ms cubic-bezier(.76,0,.18,1)" : "none",
                visibility: Math.abs(off) <= 1 ? "visible" : "hidden",
              }}
            >
              <div
                className="absolute inset-[0_-14%] will-change-transform"
                style={{
                  transform: `translate3d(${-off * 18}%,0,0)`,
                  transition: near && !reduced ? "transform 1250ms cubic-bezier(.76,0,.18,1)" : "none",
                }}
              >
                <div className={`absolute inset-0 ${k === i && !reduced ? "hero-drift" : ""}`}>
                  <Image
                    src={h.image}
                    alt=""
                    fill
                    priority={k === 0}
                    sizes="115vw"
                    style={{ objectPosition: h.position }}
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/70 to-forest-950/5 max-sm:from-forest-950/85 max-sm:via-forest-950/60 max-sm:to-forest-950/30" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-t from-forest-950/90 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-forest-950/50 to-transparent" />

      <div className="mx-auto flex min-h-[540px] max-w-[1500px] flex-col justify-center px-5 pb-44 pt-12 sm:min-h-[640px]">
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold ring-1 ring-white/15 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> National Sports Digital Registry
        </p>

        <div key={s.sport} className="mt-5 max-w-[640px]" aria-live={playing ? "off" : "polite"}>
          <p className="hero-rise text-sm font-bold uppercase tracking-[0.2em] text-gold" style={{ animationDelay: "380ms" }}>
            <span className="mr-2 tabular-nums text-white/60">{String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>{s.label}
          </p>
          <h1 className="hero-rise mt-2 text-[clamp(1.75rem,3.3vw,2.75rem)] font-bold leading-[1.03] tracking-tight" style={{ animationDelay: "480ms" }}>{s.headline}</h1>
          <p className="hero-rise mt-4 max-w-xl text-base text-white/85 sm:text-base" style={{ animationDelay: "620ms" }}>{s.line}</p>
          <div className="hero-rise mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: "760ms" }}>
            <Link href="/register" className="group inline-flex items-center gap-2.5 rounded-lg bg-gold px-6 py-3.5 text-[15px] font-bold text-forest-950 shadow-[0_16px_30px_-14px_rgba(245,180,0,0.9)] transition hover:brightness-105 sm:px-7">
              Get started <ArrowRight size={18} className="transition group-hover:translate-x-1" />
            </Link>
            <Link href={`/federations/${s.sport}`} className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 py-3.5 text-[15px] font-bold text-white backdrop-blur transition hover:bg-white/20 sm:px-6">
              {s.label} federation
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 pb-[68px] sm:gap-4">
          <div className="flex flex-1 items-center gap-1.5 sm:gap-2" role="tablist" aria-label="Choose a sport">
            {HERO_SLIDES.map((h, k) => (
              <button
                key={h.sport}
                role="tab"
                aria-selected={k === i}
                aria-label={`${h.label}, slide ${k + 1} of ${n}`}
                onClick={() => go(k)}
                className="group min-w-0 flex-1 py-2 text-left"
              >
                <span className="relative block h-[3px] overflow-hidden rounded-full bg-white/25">
                  <span
                    key={k === i ? `${i}-${running}` : "idle"}
                    className={`absolute inset-y-0 left-0 rounded-full bg-gold ${k < i ? "w-full" : k === i ? (running ? "hero-progress" : "w-full") : "w-0"}`}
                    style={k === i && running ? { animationDuration: `${INTERVAL}ms` } : undefined}
                  />
                </span>
                <span className={`mt-1.5 hidden truncate text-[11px] font-bold uppercase tracking-wider transition md:block ${k === i ? "text-white" : "text-white/55 group-hover:text-white/85"}`}>{h.label}</span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause slideshow" : "Play slideshow"} className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/20 sm:h-9 sm:w-9">
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={() => go(i - 1)} aria-label="Previous slide" className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/20 sm:h-9 sm:w-9"><ChevronLeft size={17} /></button>
            <button onClick={() => go(i + 1)} aria-label="Next slide" className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/20 sm:h-9 sm:w-9"><ChevronRight size={17} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
