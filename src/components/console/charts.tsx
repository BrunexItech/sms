"use client";

import { useId, useState } from "react";

export interface Series { name: string; color: string; values: number[] }

/** Smooth-free line + area chart: thin lines, recessive grid, a hover crosshair with a tooltip. */
export function TrendChart({ labels, series, height = 230 }: { labels: string[]; series: Series[]; height?: number }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const padL = 34, padR = 12, padT = 14, padB = 26;
  const H = height;
  const max = Math.max(4, ...series.flatMap((s) => s.values));
  const top = Math.ceil(max / 4) * 4;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, labels.length - 1);
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);
  const ticks = [0, 1, 2, 3, 4].map((k) => (top / 4) * k);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-2"><span aria-hidden className="h-[3px] w-4 rounded-full" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Weekly trend: ${series.map((s) => s.name).join(" and ")}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.min(labels.length - 1, Math.max(0, Math.round(((px - padL) / (W - padL - padR)) * (labels.length - 1)))));
          }}
        >
          <defs>
            {series.map((s, k) => (
              <linearGradient key={s.name} id={`${id}-g${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-line" strokeWidth={1} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3" fontSize={10.5}>{Math.round(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % 2 === 0 || labels.length < 7) && (
            <text key={i} x={x(i)} y={H - 7} textAnchor="middle" className="fill-ink-3" fontSize={10.5}>{l}</text>
          ))}
          {series.map((s, k) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
            return (
              <g key={s.name}>
                {k === 0 && <polygon points={`${x(0)},${y(0)} ${pts.join(" ")} ${x(s.values.length - 1)},${y(0)}`} fill={`url(#${id}-g${k})`} />}
                <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />}
              </g>
            );
          })}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="currentColor" className="text-ink-3" strokeDasharray="3 3" strokeWidth={1} />}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[130px] rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-[0_14px_30px_-16px_rgba(6,45,87,0.5)]"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > labels.length / 2 ? "translateX(-108%)" : "translateX(8%)" }}
          >
            <p className="mb-1 font-bold text-forest-900">Week of {labels[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center justify-between gap-4 text-ink-2">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                <b className="text-forest-900">{s.values[hover]}</b>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One 100% bar split into labelled segments, with a legend that carries the counts. */
export function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-bone" role="img" aria-label={shown.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {shown.map((p) => (
          <span key={p.label} title={`${p.label}: ${p.value}`} className="first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-4 grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-ink-2"><span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />{p.label}</span>
            <b className="tabular-nums text-forest-900">{p.value.toLocaleString()}</b>
          </li>
        ))}
      </ul>
      {total === 0 && <p className="mt-3 text-sm text-ink-3">No data yet.</p>}
    </div>
  );
}

/** Headline figure with change against the previous period. */
export function Kpi({ label, value, hint, delta, tone = "default", icon }: { label: string; value: React.ReactNode; hint?: string; delta?: number | null; tone?: "default" | "good" | "alert"; icon?: React.ReactNode }) {
  const ring = tone === "alert" ? "border-kenya-red/30" : "border-line";
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-[0_18px_40px_-36px_rgba(6,45,87,0.7)] ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">{label}</p>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold leading-none tabular-nums ${tone === "alert" ? "text-kenya-red" : "text-forest-900"}`}>{value}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-bold ${delta >= 0 ? "bg-leaf/15 text-leaf" : "bg-red-50 text-kenya-red"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>
        )}
        {hint}
      </p>
    </div>
  );
}

/** Circular progress with the figure in the middle (one hue, thin stroke). */
export function Ring({ value, label, color = "#12743f", size = 120 }: { value: number; label: string; color?: string; size?: number }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${v}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-line" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <span className="absolute text-center leading-tight">
        <b className="block text-xl tabular-nums text-forest-900">{v}%</b>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">{label}</span>
      </span>
    </div>
  );
}

const TONES = {
  blue: { chip: "bg-[#2f6fc4]/12 text-[#2f6fc4]", bar: "#2f6fc4" },
  green: { chip: "bg-leaf/15 text-leaf", bar: "#12743f" },
  amber: { chip: "bg-gold-soft text-[#9a6b00]", bar: "#d99a00" },
  red: { chip: "bg-red-50 text-kenya-red", bar: "#c8102e" },
  navy: { chip: "bg-forest-100 text-forest-800", bar: "#0b4f8a" },
} as const;
export type KpiTone = keyof typeof TONES;

/** A headline card that opens a detail panel when toggled. */
export function KpiToggle({ label, value, hint, delta, tone, icon, active, onToggle, controls }: {
  label: string; value: React.ReactNode; hint?: string; delta?: number | null; tone: KpiTone; icon: React.ReactNode; active: boolean; onToggle: () => void; controls: string;
}) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={active}
      aria-controls={controls}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-28px_rgba(6,45,87,0.7)] ${active ? "border-forest-700 shadow-[0_22px_44px_-28px_rgba(6,45,87,0.7)]" : "border-line shadow-[0_14px_34px_-34px_rgba(6,45,87,0.7)]"}`}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] transition-opacity" style={{ background: t.bar, opacity: active ? 1 : 0.35 }} />
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.chip}`}>{icon}</span>
        <span aria-hidden className={`grid h-6 w-6 place-items-center rounded-full text-ink-3 transition duration-200 group-hover:bg-bone ${active ? "rotate-180 bg-bone" : ""}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <p className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-forest-900">{value}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-bold ${delta >= 0 ? "bg-leaf/15 text-leaf" : "bg-red-50 text-kenya-red"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>
        )}
        {hint}
      </p>
    </button>
  );
}
