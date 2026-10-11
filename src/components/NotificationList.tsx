"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useStore } from "@/lib/store";

export function NotificationList() {
  const { state, markNotificationsRead } = useStore();
  const items = state.notifications;
  const unread = items.filter((n) => !n.read).length;
  if (items.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 print:hidden" aria-label="Notifications">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-forest-900">
          <Bell size={18} /> Notifications {unread > 0 && <span className="rounded-full bg-kenya-red px-2 py-0.5 text-xs font-bold text-white">{unread} new</span>}
        </h2>
        {unread > 0 && <button onClick={markNotificationsRead} className="text-sm font-bold text-forest-700 underline underline-offset-4">Mark all read</button>}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {items.slice(0, 6).map((n) => (
          <li key={n.id} className={`py-3 ${n.read ? "opacity-70" : ""}`}>
            <p className="text-sm font-bold">{n.title}</p>
            <p className="text-sm text-ink-2">{n.body}</p>
            <p className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-3">
              {new Date(n.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
              <Link href={n.link} className="font-bold text-forest-700 underline">Open</Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
