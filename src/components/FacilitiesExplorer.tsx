"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Crosshair, MapPin, Plus, Search, Users } from "lucide-react";
import { FACILITY_GROUPS, groupOf } from "@/data/facility-groups";
import { SPORT_BY_ID, SPORTS } from "@/data/sports";
import { emptyPlace, formatPlace, nearestPlace } from "@/lib/admin";
import { errText, useStore } from "@/lib/store";
import {
  CONDITIONS,
  FACILITY_TYPES,
  OWNERSHIP,
  type Facility,
  type FacilityType,
  type GeoPoint,
  type Place,
} from "@/lib/types";
import { LocationFields } from "./LocationFields";
import { SportPicker } from "./SportPicker";
import { Field, inputCls } from "./ui/Field";
import { Pill } from "./ui/Pill";
import { BlockLoader, ButtonSpinner } from "./ui/Spinner";
import type { MapPoint } from "./GeoMap";

const GeoMap = dynamic(() => import("./GeoMap").then((m) => m.GeoMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[#dfe9e3]">
      <BlockLoader label="Loading map" />
    </div>
  ),
});

const STATUS_COLOR = { Verified: "#1a9150", Unverified: "#c9a24b", Rejected: "#c8102e" } as const;

interface Hit {
  name: string;
  lat: number;
  lon: number;
}

export function FacilitiesExplorer() {
  const { state, admin, addFacility, me } = useStore();
  const qs = useSearchParams();
  const seq = useRef(0);
  const [mode, setMode] = useState<"browse" | "register">("browse");
  const [county, setCounty] = useState(qs.get("county") ?? "");
  const [sport, setSport] = useState(qs.get("sport") ?? "");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(qs.get("focus"));
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom?: number; key: string } | null>(() => {
    const id = qs.get("focus");
    const f = id ? state.facilities.find((x) => x.id === id) : null;
    return f ? { lat: f.gps.lat, lon: f.gps.lon, zoom: 15, key: `f-${f.id}` } : null;
  });

  // register form
  const [draft, setDraft] = useState({
    name: "",
    type: "Stadium" as FacilityType,
    sports: [] as string[],
    place: emptyPlace() as Place,
    capacity: "",
    ownership: OWNERSHIP[1] as string,
    condition: "Good" as string,
  });
  const [pick, setPick] = useState<GeoPoint | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Facility | null>(null);
  const [saving, setSaving] = useState(false);

  // place search (Nominatim, user-initiated only to respect the usage policy)
  const [placeQ, setPlaceQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.facilities.filter(
      (f) =>
        (!county || f.place.countyId === county) &&
        (!sport || f.sports.includes(sport)) &&
        (!type || f.type === type) &&
        (!status || f.status === status) &&
        (!needle || `${f.name} ${formatPlace(f.place)}`.toLowerCase().includes(needle)),
    );
  }, [state.facilities, county, sport, type, status, q]);

  const points: MapPoint[] = useMemo(
    () =>
      filtered.map((f) => ({
        id: f.id,
        lat: f.gps.lat,
        lon: f.gps.lon,
        title: f.name,
        color: groupOf(f.type).color,
      })),
    [filtered],
  );

  const sel = selected ? state.facilities.find((f) => f.id === selected) : null;

  const select = (id: string) => {
    setSelected(id);
    const f = state.facilities.find((x) => x.id === id);
    if (f) setFocus({ lat: f.gps.lat, lon: f.gps.lon, zoom: 15, key: `f-${id}-${++seq.current}` });
  };

  const setPicked = (g: GeoPoint) => {
    setPick(g);
    setDraft((d) => ({ ...d, place: nearestPlace(admin, g.lat, g.lon) }));
    setErrors((e) => ({ ...e, gps: "" }));
  };

  const searchPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeQ.trim()) return;
    setSearching(true);
    setHits(null);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ke&limit=6&q=${encodeURIComponent(placeQ)}`,
        { headers: { Accept: "application/json" } },
      );
      const j: { display_name: string; lat: string; lon: string }[] = await r.json();
      setHits(j.map((x) => ({ name: x.display_name, lat: +x.lat, lon: +x.lon })));
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const goHit = (h: Hit) => {
    setFocus({ lat: h.lat, lon: h.lon, zoom: 15, key: `h-${++seq.current}` });
    if (mode === "register") setPicked({ lat: h.lat, lon: h.lon });
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (draft.name.trim().length < 3) e.name = "Enter the facility name.";
    if (!draft.place.wardId) e.place = "Choose county, sub-county and ward (or click the map).";
    if (!pick) e.gps = "Click the map (or capture GPS) to place the facility.";
    if (draft.sports.length === 0) e.sports = "Choose at least one sport.";
    setErrors(e);
    if (Object.keys(e).length || !pick) return;
    setSaving(true);
    try {
      const f = await addFacility({
        name: draft.name.trim(),
        type: draft.type,
        sports: draft.sports,
        place: draft.place,
        gps: pick,
        capacity: draft.capacity ? Number(draft.capacity) : undefined,
        ownership: draft.ownership,
        condition: draft.condition,
      });
      setCreated(f);
      setPick(null);
      setDraft((d) => ({ ...d, name: "", sports: [], capacity: "", place: emptyPlace() }));
      setSelected(f.id);
      setFocus({ lat: f.gps.lat, lon: f.gps.lon, zoom: 15, key: `n-${f.id}` });
    } catch (x) {
      setErrors({ place: errText(x) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-24">
      <div className="-mt-8 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* map */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)]">
          <form onSubmit={searchPlace} className="flex gap-2 border-b border-line p-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                className={`${inputCls} py-2.5 pl-10`}
                placeholder="Find any place in Kenya, e.g. Kasarani Stadium, Eldoret"
                value={placeQ}
                onChange={(e) => setPlaceQ(e.target.value)}
              />
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-5 text-sm font-semibold text-white hover:bg-forest-700">
              {searching ? <ButtonSpinner /> : <MapPin size={16} />} Search
            </button>
          </form>
          {hits && (
            <ul className="max-h-44 divide-y divide-line overflow-y-auto border-b border-line bg-bone/60 text-sm">
              {hits.length === 0 && <li className="px-4 py-3 text-ink-3">No place found.</li>}
              {hits.map((h, i) => (
                <li key={i}>
                  <button onClick={() => goHit(h)} className="w-full px-4 py-2.5 text-left transition hover:bg-forest-100">
                    {h.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="h-[min(70vh,620px)] min-h-[420px]">
            <GeoMap
              className="h-full"
              points={points}
              selectedId={selected}
              onSelect={(id) => {
                setSelected(id);
                setMode("browse");
              }}
              pick={mode === "register" ? pick : null}
              onPick={mode === "register" ? setPicked : undefined}
              focus={focus}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-xs text-ink-2">
            {FACILITY_GROUPS.map((g) => (
              <span key={g.id} className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} /> {g.label}
              </span>
            ))}
            <span className="ml-auto font-semibold">{filtered.length.toLocaleString()} shown</span>
          </div>
        </div>

        {/* panel */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)]">
          <div className="grid grid-cols-2 gap-1 border-b border-line bg-bone/60 p-1.5">
            {(["browse", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setCreated(null);
                }}
                aria-pressed={mode === m}
                className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold transition ${
                  mode === m ? "bg-forest-800 text-white" : "text-ink-2 hover:bg-forest-100"
                }`}
              >
                {m === "browse" ? <Search size={15} /> : <Plus size={15} />}
                {m === "browse" ? "Browse register" : "Register a facility"}
              </button>
            ))}
          </div>

          {mode === "browse" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="grid grid-cols-2 gap-2 border-b border-line p-3">
                <input className={`${inputCls} col-span-2 py-2.5`} placeholder="Search facilities…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className={`${inputCls} py-2.5`} value={county} onChange={(e) => setCounty(e.target.value)} aria-label="County">
                  <option value="">All counties</option>
                  {admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
                </select>
                <select className={`${inputCls} py-2.5`} value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport">
                  <option value="">Any sport</option>
                  {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className={`${inputCls} py-2.5`} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
                  <option value="">Any type</option>
                  {FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select className={`${inputCls} py-2.5`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                  <option value="">Any status</option>
                  <option>Verified</option>
                  <option>Unverified</option>
                </select>
              </div>

              {sel && (
                <div className="border-b border-line bg-forest-100/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-medium leading-tight">{sel.name}</p>
                      <p className="mt-1 text-xs text-ink-3">{sel.id} · {sel.type} · {sel.source}</p>
                    </div>
                    <Pill>{sel.status}</Pill>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2"><MapPin size={14} /> {formatPlace(sel.place)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3"><Crosshair size={13} /> {sel.gps.lat.toFixed(5)}, {sel.gps.lon.toFixed(5)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {sel.capacity ? <span className="mr-1 flex items-center gap-1 text-xs"><Users size={13} /> {sel.capacity.toLocaleString()}</span> : null}
                    {sel.condition && <Pill>{sel.condition}</Pill>}
                    {sel.sports.map((s) => (
                      <span key={s} className="flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[11px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={SPORT_BY_ID[s]?.image} alt="" className="h-3.5 w-3.5" /> {SPORT_BY_ID[s]?.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <ul className="max-h-[360px] min-h-[160px] flex-1 divide-y divide-line overflow-y-auto">
                {filtered.slice(0, 80).map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => select(f.id)}
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-bone ${selected === f.id ? "bg-forest-100/60" : ""}`}
                    >
                      <span>
                        <span className="block text-sm font-semibold leading-snug">{f.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">{f.type} · {formatPlace(f.place)}</span>
                      </span>
                      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[f.status] }} />
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-4 py-12 text-center text-sm text-ink-3">No facilities match these filters.</li>}
                {filtered.length > 80 && <li className="px-4 py-3 text-center text-xs text-ink-3">Showing 80 of {filtered.length}. Narrow the filters to see the rest.</li>}
              </ul>
            </div>
          ) : created ? (
            <div className="step-anim p-8 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-100 text-forest-700"><CheckCircle2 size={30} /></span>
              <h3 className="font-display mt-5 text-xl font-medium">Facility submitted</h3>
              <p className="mt-2 text-sm text-ink-2">
                <b>{created.name}</b> ({created.id}) is now in the verification queue of the Facilities Officer.
              </p>
              <button onClick={() => { setCreated(null); }} className="mt-6 rounded-full bg-forest-800 px-6 py-3 text-sm font-semibold text-white hover:bg-forest-700">
                Register another
              </button>
            </div>
          ) : !me ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-bold text-forest-900">Sign in to register a facility</h3>
              <p className="mt-2 text-sm text-ink-2">Facility submissions are tied to an account so the Facilities Officer can follow up.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/login" className="rounded-lg bg-forest-800 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
                <Link href="/register" className="rounded-lg bg-gold px-5 py-2.5 text-sm font-bold text-forest-950">Register</Link>
              </div>
            </div>
          ) : (
            <div className="max-h-[720px] space-y-5 overflow-y-auto p-5">
              <p className="flex gap-2 rounded-xl bg-gold-soft/60 p-3 text-[13px] text-ink-2">
                <Crosshair size={16} className="mt-0.5 shrink-0" />
                Click the map to drop the pin, or search for the place above. The ward fills in automatically.
              </p>
              <Field label="Facility name" required error={errors.name}>
                <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Facility type">
                  <select className={inputCls} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as FacilityType })}>
                    {FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Capacity (people)">
                  <input className={inputCls} inputMode="numeric" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value.replace(/\D/g, "") })} />
                </Field>
                <Field label="Ownership">
                  <select className={inputCls} value={draft.ownership} onChange={(e) => setDraft({ ...draft, ownership: e.target.value })}>
                    {OWNERSHIP.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Condition">
                  <select className={inputCls} value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })}>
                    {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <div>
                <span className="mb-1.5 block text-[13px] font-semibold">Sports played <span className="text-kenya-red">*</span></span>
                <SportPicker multiple value={draft.sports} onChange={(v) => setDraft({ ...draft, sports: v })} />
                {errors.sports && <span className="mt-1.5 block text-xs font-medium text-kenya-red">{errors.sports}</span>}
              </div>
              <LocationFields
                place={draft.place}
                onPlace={(p) => setDraft({ ...draft, place: p })}
                gps={pick ?? undefined}
                onGps={(g) => { setPicked(g); setFocus({ ...g, zoom: 16, key: `g-${++seq.current}` }); }}
              />
              {(errors.place || errors.gps) && (
                <p className="text-xs font-medium text-kenya-red">{errors.place || errors.gps}</p>
              )}
              <button
                onClick={submit}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-sm font-semibold text-forest-950 transition hover:brightness-105 disabled:opacity-80"
              >
                {saving ? <ButtonSpinner /> : <Plus size={16} />}
                {saving ? "Submitting…" : "Submit facility for verification"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
