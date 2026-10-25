"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { SPORTS, SPORT_GROUPS, type SportGroup } from "@/data/sports";
import { useStore } from "@/lib/store";
import { Reveal } from "./Reveal";

export function SportsGrid() {
  const { state, federationName } = useStore();
  const [group, setGroup] = useState<SportGroup | "All">("All");

  const counts = useMemo(() => {
    const c: Record<string, { fac: number; reg: number }> = {};
    for (const s of SPORTS) c[s.id] = { fac: 0, reg: 0 };
    for (const f of state.facilities) for (const s of f.sports) if (c[s]) c[s].fac++;
    for (const [sp, n] of Object.entries(state.stats.bySport)) if (c[sp]) c[sp].reg = n;
    return c;
  }, [state]);

  const list = SPORTS.filter((s) => group === "All" || s.group === group);

  return (
    <section id="all-sports" className="scroll-mt-24 border-t border-line bg-white py-20">
      <div className="mx-auto max-w-[1500px] px-5">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-forest-700">All sports</p>
            <h2 className="mt-2 max-w-xl text-2xl font-bold leading-[1.08] tracking-tight text-forest-900">
              {SPORTS.length} disciplines, each with its federation
            </h2>
          </div>
          <p className="max-w-sm text-sm text-ink-3">
            Choose a sport to register under it. Counts show facilities on the map and approved registrations.
          </p>
        </Reveal>

        <div className="mt-7 flex flex-wrap gap-2">
          {(["All", ...SPORT_GROUPS] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${group === g ? "border-forest-800 bg-forest-800 text-white" : "border-line bg-white text-ink-2 hover:border-forest-700"}`}
            >
              {g}
            </button>
          ))}
        </div>

        <ul className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {list.map((s, i) => (
            <li key={s.id}>
              <Reveal delay={(i % 5) * 50}>
                <Link
                  href={`/register?sport=${s.id}`}
                  className="group relative block aspect-[5/4] overflow-hidden rounded-2xl bg-forest-900 shadow-[0_18px_34px_-24px_rgba(6,45,87,0.7)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_44px_-24px_rgba(6,45,87,0.8)]"
                >
                  <Image
                    src={s.image}
                    alt={`${s.name}: ${s.item}`}
                    fill
                    sizes="(min-width:1024px) 18vw, (min-width:768px) 30vw, 46vw"
                    className="object-cover transition duration-700 group-hover:scale-110"
                  />
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/25 to-transparent" />
                  <ArrowUpRight size={20} className="absolute right-3.5 top-3.5 rounded-full bg-white/90 p-1 text-forest-900 opacity-0 transition group-hover:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <h3 className="text-lg font-bold leading-tight">{s.name}</h3>
                    <p className="mt-0.5 line-clamp-1 text-[11.5px] text-white/70">{federationName(s.id) || s.federation}</p>
                    <p className="mt-2 text-[11.5px] font-semibold text-gold">
                      {counts[s.id].fac} facilities · {counts[s.id].reg} registered
                    </p>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
