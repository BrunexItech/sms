"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { SPORT_BY_ID, STRIP_SPORT_IDS } from "@/data/sports";

/** The row of sport photographs under the hero. Picking one filters the map and presets registration. */
export function SportsStrip({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  return (
    <div className="mx-auto -mt-[52px] max-w-[1500px] px-3 sm:px-5">
      <div className="relative rounded-2xl bg-white p-2 shadow-[0_26px_50px_-26px_rgba(6,45,87,0.55)] ring-1 ring-line">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-13" role="list">
          {STRIP_SPORT_IDS.map((id) => {
            const s = SPORT_BY_ID[id];
            const on = value === id;
            return (
              <li key={id}>
                <button
                  onClick={() => onChange(on ? null : id)}
                  aria-pressed={on}
                  className={`group relative flex w-full flex-col items-center overflow-hidden rounded-xl p-1.5 text-center transition ${
                    on ? "bg-gradient-to-b from-forest-800 to-forest-900 text-white shadow-lg" : "bg-white text-ink hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-forest-700/30"
                  }`}
                >
                  <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-bone">
                    <Image
                      src={s.image}
                      alt={`${s.name}: ${s.item}`}
                      fill
                      sizes="(min-width:1280px) 7vw, (min-width:768px) 14vw, 30vw"
                      className="object-cover transition duration-500 group-hover:scale-110"
                    />
                    {on && (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-forest-950">
                        <Check size={12} strokeWidth={3.5} />
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 text-[13px] font-bold">{s.name}</span>
                </button>
              </li>
            );
          })}
          <li>
            <a
              href="#all-sports"
              className="flex h-full min-h-[92px] w-full flex-col items-center justify-center gap-1 rounded-xl bg-bone text-forest-900 transition hover:bg-forest-100"
            >
              <span className="flex gap-1" aria-hidden>
                <i className="h-2 w-2 rounded-full bg-forest-800" />
                <i className="h-2 w-2 rounded-full bg-forest-800" />
                <i className="h-2 w-2 rounded-full bg-forest-800" />
              </span>
              <span className="text-[13px] font-bold">More Sports</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
