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
