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
      <div className="absolute inset-0 -z-20">
        {HERO_SLIDES.map((h, k) => (
          <Image
            key={h.sport}
            src={h.image}
            alt=""
            fill
            priority={k === 0}
            sizes="100vw"
            style={{ objectPosition: h.position }}
            className={`object-cover transition-opacity duration-[1200ms] ease-out ${k === i ? "opacity-100" : "opacity-0"} ${k === i && !reduced ? "hero-zoom" : ""}`}
          />
        ))}
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest-950 via-forest-950/75 to-forest-950/10" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-forest-950/85 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-forest-950/50 to-transparent" />

      <div className="mx-auto flex min-h-[520px] max-w-[1500px] flex-col justify-center px-5 pb-28 pt-12 sm:min-h-[600px]">
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold ring-1 ring-white/15 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> National Sports Digital Registry
        </p>

        <div key={s.sport} className="hero-copy mt-5 max-w-[640px]" aria-live={playing ? "off" : "polite"}>
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-gold">{s.label}</p>
          <h1 className="mt-2 text-[clamp(2.1rem,4.6vw,3.9rem)] font-black leading-[1.02] tracking-tight">{s.headline}</h1>
          <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">{s.line}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/register" className="group inline-flex items-center gap-2.5 rounded-lg bg-gold px-7 py-3.5 text-[15px] font-extrabold text-forest-950 shadow-[0_16px_30px_-14px_rgba(245,180,0,0.9)] transition hover:brightness-105">
              Get started <ArrowRight size={18} className="transition group-hover:translate-x-1" />
            </Link>
            <Link href={`/federations/${s.sport}`} className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-6 py-3.5 text-[15px] font-bold text-white backdrop-blur transition hover:bg-white/20">
              {s.label} federation
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-5 pb-6">
          <div className="flex flex-1 items-center gap-2" role="tablist" aria-label="Choose a sport">
            {HERO_SLIDES.map((h, k) => (
              <button
                key={h.sport}
                role="tab"
                aria-selected={k === i}
                aria-label={`${h.label}, slide ${k + 1} of ${n}`}
                onClick={() => go(k)}
                className="group min-w-0 flex-1 text-left"
              >
                <span className="relative block h-[3px] overflow-hidden rounded-full bg-white/25">
                  <span
                    key={k === i ? `${i}-${running}` : "idle"}
                    className={`absolute inset-y-0 left-0 rounded-full bg-gold ${k < i ? "w-full" : k === i ? (running ? "hero-progress" : "w-full") : "w-0"}`}
                    style={k === i && running ? { animationDuration: `${INTERVAL}ms` } : undefined}
                  />
                </span>
                <span className={`mt-2 hidden truncate text-[11px] font-bold uppercase tracking-wider transition sm:block ${k === i ? "text-white" : "text-white/55 group-hover:text-white/85"}`}>{h.label}</span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause slideshow" : "Play slideshow"} className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/20">
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={() => go(i - 1)} aria-label="Previous slide" className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/20"><ChevronLeft size={17} /></button>
            <button onClick={() => go(i + 1)} aria-label="Next slide" className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/20"><ChevronRight size={17} /></button>
          </div>
        </div>
      </div>
      <p className="absolute right-5 top-4 z-10 hidden text-[10px] text-white/55 sm:block">
        Photo: {s.credit.author}, {s.credit.license}, via <a href={s.credit.page} target="_blank" rel="noreferrer" className="underline">Wikimedia Commons</a>
      </p>
    </section>
  );
}
