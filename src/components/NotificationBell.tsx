"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useStore } from "@/lib/store";

/** Header bell: unread count, and a dropdown of recent notices that works from phone to desktop. */
export function NotificationBell({ allHref }: { allHref: string }) {
  const { state, markNotificationsRead } = useStore();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const items = state.notifications;
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className={`relative grid h-10 w-10 place-items-center rounded-lg text-forest-900 transition hover:bg-forest-100 ${open ? "bg-forest-100" : ""}`}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-kenya-red px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="step-anim fixed inset-x-3 top-[112px] z-[60] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_70px_-30px_rgba(6,45,87,0.6)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[380px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line bg-forest-100/50 px-4 py-3">
            <h2 className="text-sm font-bold text-forest-900">Notifications{unread > 0 && <span className="ml-2 rounded-full bg-kenya-red px-2 py-0.5 text-[11px] font-bold text-white">{unread} new</span>}</h2>
            {unread > 0 && (
              <button onClick={markNotificationsRead} className="inline-flex items-center gap-1.5 text-xs font-bold text-forest-700 hover:underline"><CheckCheck size={14} /> Mark all read</button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-3">
              <BellOff className="mx-auto mb-2" size={22} />
              You are all caught up.
            </div>
          ) : (
            <ul className="max-h-[min(420px,60vh)] divide-y divide-line overflow-y-auto overscroll-contain">
              {items.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <Link href={n.link || allHref} onClick={() => setOpen(false)} className={`flex gap-3 px-4 py-3 transition hover:bg-bone ${n.read ? "" : "bg-forest-100/30"}`}>
                    <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-kenya-red"}`} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-forest-900">{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-ink-2">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-ink-3">{new Date(n.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={allHref} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-[13px] font-bold text-forest-700 hover:bg-bone">View all in your account</Link>
        </div>
      )}
    </div>
  );
}
