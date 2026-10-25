"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { FACILITY_GROUPS, groupOf } from "@/data/facility-groups";
import { SPORT_BY_ID } from "@/data/sports";
import { useStore } from "@/lib/store";
import { Pill } from "./ui/Pill";
import { BlockLoader } from "./ui/Spinner";
import type { MapPoint } from "./GeoMap";

const GeoMap = dynamic(() => import("./GeoMap").then((m) => m.GeoMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[#e6eef0]">
      <BlockLoader label="Loading map" />
    </div>
  ),
});

const selectCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-forest-700 focus:ring-4 focus:ring-forest-700/10 disabled:bg-bone disabled:text-ink-3";

/** The "Sports Facilities Map" card from the Ministry mockup: County / Sub-County / Ward search, legend and facility popup. */
export function FacilityMapPanel({ sportId }: { sportId: string | null }) {
  const { state, admin } = useStore();
  const seq = useRef(0);
  const [countyId, setCountyId] = useState("");
  const [subId, setSubId] = useState("");
  const [wardId, setWardId] = useState("");
  const [applied, setApplied] = useState({ countyId: "", subId: "", wardId: "" });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [fq, setFq] = useState("");
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom?: number; key: string } | null>(null);

  const county = admin.counties.find((c) => c.id === countyId);
  const sub = county?.s.find((s) => s.id === subId);

  const visible = useMemo(
    () =>
      state.facilities.filter((f) => {
        if (hidden.has(groupOf(f.type).id)) return false;
        if (sportId && !f.sports.includes(sportId)) return false;
        if (applied.wardId && f.place.wardId !== applied.wardId) return false;
        if (applied.subId && f.place.subId !== applied.subId) return false;
        if (applied.countyId && f.place.countyId !== applied.countyId) return false;
        return true;
      }),
    [state.facilities, hidden, sportId, applied],
  );

  const points: MapPoint[] = useMemo(
    () => visible.map((f) => ({ id: f.id, lat: f.gps.lat, lon: f.gps.lon, title: f.name, color: groupOf(f.type).color })),
    [visible],
  );

  const matches = fq.trim().length >= 2 ? state.facilities.filter((f) => f.name.toLowerCase().includes(fq.trim().toLowerCase())).slice(0, 6) : [];
  const sel = selected ? state.facilities.find((f) => f.id === selected) : null;

  const search = () => {
    setApplied({ countyId, subId, wardId });
    setSelected(null);
    const w = sub?.w.find((x) => x.id === wardId);
    const t = w ? { ...w, z: 14 } : sub ? { ...sub, z: 12 } : county ? { ...county, z: 9 } : null;
    setFocus(t ? { lat: t.la, lon: t.lo, zoom: t.z, key: `s-${++seq.current}` } : { lat: 0.3, lon: 37.9, zoom: 6, key: `s-${++seq.current}` });
  };

  const toggle = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-[0_18px_40px_-28px_rgba(6,45,87,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-forest-900">Sports Facilities Map</h2>
          <p className="mt-1 text-sm text-ink-3">
            Explore and locate sports facilities across Kenya by County, Sub-County and Ward.
            {sportId && <> Showing <b className="text-forest-900">{SPORT_BY_ID[sportId]?.name}</b> facilities.</>}
          </p>
        </div>
        <Link href="/facilities" className="shrink-0 rounded-lg border border-forest-700 px-3.5 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-100">
          View All Facilities
        </Link>
      </div>

      <div className="relative mt-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          value={fq}
          onChange={(e) => setFq(e.target.value)}
          placeholder="Search a facility by name, e.g. Nyayo, Kasarani, Moi…"
          className={`${selectCls} pl-10`}
          aria-label="Search facilities by name"
        />
        {matches.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-[600] mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-xl">
            {matches.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => { setSelected(f.id); setFocus({ lat: f.gps.lat, lon: f.gps.lon, zoom: 15, key: `q-${++seq.current}` }); setFq(""); }}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-forest-100"
                >
                  <span className="font-semibold">{f.name}</span>
                  <span className="shrink-0 text-xs text-ink-3">{f.place.county}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-xs font-semibold text-ink-2">
          Select County
          <select className={`${selectCls} mt-1`} value={countyId} onChange={(e) => { setCountyId(e.target.value); setSubId(""); setWardId(""); }}>
            <option value="">All counties</option>
            {admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-2">
          Select Sub-County
          <select className={`${selectCls} mt-1`} value={subId} disabled={!county} onChange={(e) => { setSubId(e.target.value); setWardId(""); }}>
            <option value="">{county ? "All sub-counties" : "Choose county"}</option>
            {county?.s.map((s) => <option key={s.id} value={s.id}>{s.n}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-2">
          Select Ward
          <select className={`${selectCls} mt-1`} value={wardId} disabled={!sub} onChange={(e) => setWardId(e.target.value)}>
            <option value="">{sub ? "All wards" : "Choose sub-county"}</option>
            {sub?.w.map((w) => <option key={w.id} value={w.id}>{w.n}</option>)}
          </select>
        </label>
        <button onClick={search} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-forest-700 to-forest-800 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110">
          <Search size={16} /> Search
        </button>
      </div>

      <div className="relative mt-4 min-h-[430px] flex-1 overflow-hidden rounded-xl border border-line">
        <div className="absolute inset-0">
          <GeoMap
            className="h-full w-full"
            points={points}
            selectedId={selected}
            onSelect={setSelected}
            focus={focus}
            zoomPosition="bottomright"
          />
        </div>

        {/* legend (also a filter) */}
        <div className="absolute left-3 top-3 z-[500] max-h-[calc(100%-1.5rem)] w-[184px] overflow-y-auto rounded-xl bg-white/95 p-2.5 shadow-lg backdrop-blur">
          {FACILITY_GROUPS.map((g) => {
            const on = !hidden.has(g.id);
            const n = state.facilities.filter((f) => groupOf(f.type).id === g.id).length;
            return (
              <button key={g.id} onClick={() => toggle(g.id)} aria-pressed={on} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium transition hover:bg-bone ${on ? "text-ink" : "text-ink-3 line-through"}`}>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: on ? g.color : "#cbd5e1" }}>
                  <MapPin size={11} className="text-white" />
                </span>
                <span className="flex-1 leading-tight">{g.label}</span>
                <span className="text-[11px] text-ink-3">{n}</span>
              </button>
            );
          })}
        </div>

        {/* facility popup */}
        {sel && (
          <div className="step-anim absolute bottom-3 left-3 right-14 z-[500] max-w-[320px] rounded-xl bg-white p-3.5 shadow-xl sm:left-auto sm:right-14 sm:bottom-12">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold leading-snug text-forest-900">{sel.name}</p>
              <Pill>{sel.status}</Pill>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {groupOf(sel.type).label.replace(/s$/, "")} · {[sel.place.subCounty, sel.place.county].filter(Boolean).join(", ")}
            </p>
            {sel.sports.length > 0 && (
              <p className="mt-1 text-xs text-ink-2">{sel.sports.map((s) => SPORT_BY_ID[s]?.name).join(", ")}</p>
            )}
            <Link href={`/facilities?focus=${encodeURIComponent(sel.id)}`} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-forest-700 hover:underline">
              View Details <ArrowRight size={12} />
            </Link>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-ink-2 shadow">
          {visible.length.toLocaleString()} facilities shown
        </div>
      </div>
    </section>
  );
}
