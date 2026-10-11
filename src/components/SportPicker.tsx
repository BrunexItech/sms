"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { SPORTS } from "@/data/sports";

export function SportPicker({
  value,
  onChange,
  multiple = false,
  compact = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  /** Narrow container (home page card): fewer columns regardless of viewport. */
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => SPORTS.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const toggle = (id: string) => {
    if (!multiple) return onChange([id]);
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sports…"
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-forest-700 focus:ring-4 focus:ring-forest-700/12"
        />
      </div>
      <div className={`grid max-h-[320px] gap-2.5 overflow-y-auto pr-1 ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"}`}>
        {list.map((s) => {
          const on = value.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={on}
              className={`relative flex flex-col items-stretch gap-1.5 rounded-xl border p-1.5 text-center text-[12px] font-bold transition ${
                on ? "border-forest-700 bg-forest-100 text-forest-900 ring-2 ring-forest-700/30" : "border-line bg-white text-ink-2 hover:-translate-y-0.5 hover:border-forest-700/50 hover:shadow-md"
              }`}
            >
              <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-bone">
                <Image src={s.image} alt={`${s.name}: ${s.item}`} fill sizes="120px" className="object-cover" />
              </span>
              <span className="pb-0.5 leading-tight">{s.name}</span>
              {on && (
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-forest-700 text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
        {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-ink-3">No sport matches “{q}”.</p>}
      </div>
    </div>
  );
}
