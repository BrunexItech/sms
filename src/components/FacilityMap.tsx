"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { COUNTIES, KENYA_VIEWBOX } from "@/data/kenya-map";
import { project } from "@/data/facilities";
import { SPORT_BY_ID } from "@/data/sports";
import { norm } from "@/lib/admin";
import { useStore } from "@/lib/store";
import { Reveal } from "./Reveal";

/** Interpolate deep → luminous green by relative facility density. */
function shade(t: number) {
  const k = Math.pow(Math.min(1, Math.max(0, t)), 0.55);
  const a = [13, 62, 38];
  const b = [120, 214, 156];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export function FacilityMap() {
  const { state, admin } = useStore();
  const [selected, setSelected] = useState("nairobi");
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fq, setFq] = useState("");

  // Facility counts per county, keyed by normalised name so the drawn polygons and the admin list agree.
  const { counts, max, idByNorm } = useMemo(() => {
    const idByNorm: Record<string, string> = {};
    for (const c of admin.counties) idByNorm[norm(c.n)] = c.id;
    const counts: Record<string, number> = {};
    for (const f of state.facilities) {
      const k = norm(f.place.county);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return { counts, max: Math.max(1, ...Object.values(counts)), idByNorm };
  }, [state.facilities, admin]);

  const selectedCounty = COUNTIES.find((c) => norm(c.name) === selected);
  const inCounty = state.facilities.filter((f) => norm(f.place.county) === selected);
  const rank =
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .findIndex(([k]) => k === selected) + 1;

  return (
    <section id="coverage" className="bg-forest-950 py-24 text-white">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-gold">Coverage by county</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              Where Kenya&apos;s facilities <em className="text-gold">are.</em>
            </h2>
          </div>
          <Link href="/facilities" className="group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-forest-900 transition hover:bg-gold-soft">
            Open the facilities map <ArrowRight size={16} className="transition group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal className="relative h-[620px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-forest-900 to-forest-950">
            <svg
              viewBox={`-30 -30 ${KENYA_VIEWBOX.width + 60} ${KENYA_VIEWBOX.height + 60}`}
              className="h-full w-full origin-center p-3 transition-transform duration-500"
              style={{ transform: `scale(${zoom})` }}
              role="group"
              aria-label="Map of Kenya's 47 counties shaded by facility count"
              onMouseLeave={() => setHover(null)}
            >
              {COUNTIES.map((c) => {
                const k = norm(c.name);
                const n = counts[k] ?? 0;
                const on = k === selected;
                return (
                  <path
                    key={c.code}
                    d={c.d}
                    fill={on ? "#c9a24b" : shade(n / max)}
                    stroke={on ? "#fff" : "rgba(246,243,236,0.28)"}
                    strokeWidth={on ? 2.2 : 1}
                    strokeLinejoin="round"
                    tabIndex={0}
                    role="button"
                    aria-label={`${c.name} county, ${n} facilities`}
                    aria-pressed={on}
                    className="cursor-pointer outline-none transition-[fill] duration-200 hover:brightness-125 focus-visible:brightness-125"
                    onClick={() => { setSelected(k); setFq(""); }}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (setSelected(k), setFq(""))}
                    onMouseMove={(e) => {
                      const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).parentElement!.getBoundingClientRect();
                      setHover({ name: c.name, x: e.clientX - r.left, y: e.clientY - r.top });
                    }}
                  />
                );
              })}
              {state.facilities.map((f) => {
                const [x, y] = project(f.gps.lat, f.gps.lon);
                const on = norm(f.place.county) === selected;
                return (
                  <circle
                    key={f.id}
                    cx={x}
                    cy={y}
                    r={on ? 3.6 : 2.2}
                    fill={on ? "#c8102e" : "#f1e3bd"}
                    stroke="#04170d"
                    strokeWidth={0.8}
                    pointerEvents="none"
                    opacity={on ? 1 : 0.8}
                  />
                );
              })}
            </svg>

            {hover && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-xl bg-paper px-3 py-2 text-ink shadow-xl"
                style={{ left: hover.x, top: hover.y }}
              >
                <p className="text-sm font-semibold">{hover.name}</p>
                <p className="text-xs text-ink-3">{counts[norm(hover.name)] ?? 0} facilities</p>
              </div>
            )}

            <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-xl border border-white/15 bg-forest-950/80 backdrop-blur">
              {[
                { i: <Plus size={16} />, f: () => setZoom((z) => Math.min(2.2, z + 0.3)), l: "Zoom in" },
                { i: <Minus size={16} />, f: () => setZoom((z) => Math.max(1, z - 0.3)), l: "Zoom out" },
                { i: <RotateCcw size={15} />, f: () => setZoom(1), l: "Reset view" },
              ].map((b) => (
                <button key={b.l} onClick={b.f} aria-label={b.l} className="grid h-10 w-10 place-items-center transition hover:bg-white/10">{b.i}</button>
              ))}
            </div>

            <div className="absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-forest-950/80 px-4 py-3 text-[11px] backdrop-blur">
              <p className="mb-2 uppercase tracking-wider text-white/50">Facilities per county</p>
              <div className="h-2 w-36 rounded-full" style={{ background: `linear-gradient(90deg, ${shade(0)}, ${shade(1)})` }} />
              <div className="mt-1 flex justify-between text-white/60"><span>0</span><span>{max}</span></div>
            </div>
          </Reveal>

          <Reveal delay={100} className="h-[620px]">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-paper text-ink">
              <div className="border-b border-line p-6">
                <p className="eyebrow text-kenya-red">County register</p>
                <h3 className="font-display mt-1.5 text-3xl font-medium">{selectedCounty?.name ?? "Select a county"}</h3>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  {[
                    ["Facilities", inCounty.length],
                    ["Verified", inCounty.filter((f) => f.status === "Verified").length],
                    ["Density rank", rank > 0 ? `#${rank}` : "—"],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-2xl bg-bone px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wider text-ink-3">{l}</p>
                      <p className="font-display mt-0.5 text-2xl">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-b border-line px-4 py-3">
                <input
                  value={fq}
                  onChange={(e) => setFq(e.target.value)}
                  placeholder={`Search facilities in ${selectedCounty?.name ?? "this county"}…`}
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest-700 focus:ring-4 focus:ring-forest-700/10"
                />
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                {inCounty.filter((f) => !fq.trim() || f.name.toLowerCase().includes(fq.trim().toLowerCase())).slice(0, 60).map((f) => (
                  <li key={f.id} className="px-6 py-3.5 transition hover:bg-bone">
                    <Link href={`/facilities?focus=${encodeURIComponent(f.id)}`} className="block">
                      <p className="font-semibold leading-snug">{f.name}</p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {f.type}
                        {f.sports.length > 0 && ` · ${f.sports.map((s) => SPORT_BY_ID[s]?.name).join(", ")}`}
                      </p>
                    </Link>
                  </li>
                ))}
                {inCounty.length === 0 && (
                  <li className="px-6 py-8 text-center text-sm text-ink-3">
                    <MapPin className="mx-auto mb-2" size={22} />
                    No facilities on record yet in {selectedCounty?.name}.{" "}
                    <Link href="/facilities" className="font-semibold text-forest-700 underline">Register one</Link>
                  </li>
                )}
                {inCounty.length < 6 && (
                  <li className="px-6 py-5">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-3">Counties with the most facilities</p>
                    <ul className="space-y-2.5">
                      {Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => (
                        <li key={k}>
                          <button onClick={() => { setSelected(k); setFq(""); }} className="block w-full text-left">
                            <span className="flex justify-between text-sm"><span className="font-semibold">{COUNTIES.find((c) => norm(c.name) === k)?.name ?? k}</span><b>{n}</b></span>
                            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-bone"><span className="block h-full rounded-full bg-forest-700" style={{ width: `${(n / max) * 100}%` }} /></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
              {selectedCounty && idByNorm[selected] && (
                <Link href={`/facilities?county=${idByNorm[selected]}`} className="border-t border-line bg-bone px-6 py-3.5 text-sm font-semibold text-forest-800 hover:bg-forest-100">
                  View all on the full map →
                </Link>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
