"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export interface ToastItem {
  id: number;
  text: string;
  title?: string;
  tone: "ok" | "error";
}

const LIFE = 5500;

function Toast({ t, onClose }: { t: ToastItem; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(LIFE);
  const since = useRef(0);

  useEffect(() => {
    if (paused) return;
    since.current = Date.now();
    const timer = setTimeout(() => onClose(t.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(600, left.current - (Date.now() - since.current));
    };
  }, [paused, t.id, onClose]);

  const ok = t.tone === "ok";
  return (
    <div
      role={ok ? "status" : "alert"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      className="toast-in pointer-events-auto relative overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_50px_-22px_rgba(6,45,87,0.55)]"
    >
      <div className="flex items-start gap-3 p-3.5 pr-10">
        <span aria-hidden className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${ok ? "bg-leaf/15 text-leaf" : "bg-red-50 text-kenya-red"}`}>
          {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-forest-900">{t.title ?? (ok ? "Done" : "Something went wrong")}</p>
          <p className="mt-0.5 break-words text-[13px] leading-snug text-ink-2">{t.text}</p>
        </div>
      </div>
      <button onClick={() => onClose(t.id)} aria-label="Dismiss notification" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-ink-3 transition hover:bg-bone hover:text-ink">
        <X size={15} />
      </button>
      <span aria-hidden className={`toast-bar absolute inset-x-0 bottom-0 h-[3px] ${ok ? "bg-leaf" : "bg-kenya-red"}`} style={{ animationDuration: `${LIFE}ms`, animationPlayState: paused ? "paused" : "running" }} />
    </div>
  );
}

/** Stack of notices: bottom of the screen on phones, top-right below the header on larger screens. */
export function ToastViewport({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-24 z-[90] flex flex-col gap-2.5 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-[120px] sm:w-[380px]" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} t={t} onClose={onClose} />)}
    </div>
  );
}
