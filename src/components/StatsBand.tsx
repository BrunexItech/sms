"use client";

import { CalendarDays, Landmark, ScanSearch, ShieldCheck, Users, UsersRound } from "lucide-react";
import { useStore } from "@/lib/store";

export function StatsBand() {
  const { state } = useStore();
  const st = state.stats;
  const items = [
    { icon: Users, label: "Registered Individuals", n: st.players },
    { icon: ShieldCheck, label: "Registered Clubs", n: st.clubs },
    { icon: Landmark, label: "Sports Facilities", n: state.facilities.length },
    { icon: UsersRound, label: "Technical Teams", n: st.teams },
    { icon: ScanSearch, label: "Scouts", n: st.scouts },
    { icon: CalendarDays, label: "Upcoming Events", n: state.events.length },
  ];
  return (
    <section aria-label="Platform totals" className="mt-5 bg-gradient-to-b from-forest-900 to-forest-950">
      <ul className="mx-auto grid max-w-[1500px] grid-cols-2 gap-px px-3 py-1 sm:px-5 md:grid-cols-3 lg:grid-cols-6">
        {items.map((s) => (
          <li key={s.label} className="flex items-center gap-4 px-4 py-5 text-white">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10">
              <s.icon size={24} strokeWidth={1.5} />
            </span>
            <span>
              <span className="block text-[12.5px] font-medium text-white/75">{s.label}</span>
              <span className="block text-2xl font-bold tabular-nums leading-tight">{s.n.toLocaleString()}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
