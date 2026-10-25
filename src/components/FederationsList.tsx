"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { Pill } from "./ui/Pill";
import { inputCls } from "./ui/Field";

export function FederationsList() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const n = q.trim().toLowerCase();
  const rows = state.federations.filter((f) => !n || `${f.sportName} ${f.name}`.toLowerCase().includes(n));
  return (
    <div className="mx-auto max-w-[1100px] px-5">
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={`${inputCls} pl-10`} placeholder="Search by sport or federation…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search federations" />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((f) => (
          <li key={f.sportId} className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-3">{f.sportName}</p>
                <h3 className="font-extrabold text-forest-900">{f.name}</h3>
              </div>
              <Pill>{f.status}</Pill>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {f.contactEmail && <a className="inline-flex items-center gap-1.5 text-forest-700 hover:underline" href={`mailto:${f.contactEmail}`}><Mail size={14} /> {f.contactEmail}</a>}
              <Link className="font-semibold text-forest-700 hover:underline" href={`/federations/${encodeURIComponent(f.sportId)}`}>Branches &amp; leadership</Link>
              <Link className="font-semibold text-forest-700 hover:underline" href={`/clubs?sport=${encodeURIComponent(f.sportId)}`}>Clubs</Link>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="col-span-full py-12 text-center text-ink-3">No federation matches your search.</li>}
      </ul>
    </div>
  );
}
