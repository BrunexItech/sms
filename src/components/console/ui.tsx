"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <button aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-forest-950/50 backdrop-blur-[2px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="step-anim absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col bg-paper shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-display text-xl font-medium leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line hover:bg-bone">
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "alert" | "good";
}) {
  const ring = tone === "alert" ? "border-kenya-red/40 bg-red-50/60" : tone === "good" ? "border-forest-600/30 bg-forest-100/60" : "border-line bg-paper";
  return (
    <div className={`rounded-2xl border p-5 ${ring}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="font-display mt-2 text-4xl font-medium">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function BarList({ rows, max }: { rows: { label: string; value: number; color?: string }[]; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-ink-2">{r.label}</span>
            <b>{r.value.toLocaleString()}</b>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bone">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(r.value / m) * 100}%`, background: r.color ?? "#12743f" }} />
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="text-sm text-ink-3">No data yet.</li>}
    </ul>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-paper p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-medium">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function NoAccess({ need }: { need: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-10 text-center">
      <p className="font-display text-xl">Your role does not include this area.</p>
      <p className="mt-1 text-sm text-ink-3">Required permission: {need}</p>
    </div>
  );
}
