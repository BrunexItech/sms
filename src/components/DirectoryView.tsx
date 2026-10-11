"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { formatPlace } from "@/lib/admin";
import { SPORT_BY_ID, SPORTS } from "@/data/sports";
import { errText, useStore } from "@/lib/store";
import { Pill } from "./ui/Pill";
import { inputCls } from "./ui/Field";
import { BlockLoader } from "./ui/Spinner";

export type DirectoryTab = "players" | "clubs" | "teams" | "scouts" | "officials" | "support" | "facilities";
const PAGE = 15;
const LABEL: Record<DirectoryTab, string> = {
  players: "Players",
  clubs: "Clubs & organisations",
  teams: "Technical teams & coaches",
  scouts: "Scouts & agents",
  officials: "Officials & referees",
  support: "Health, welfare & operations",
  facilities: "Facilities",
};

interface Row {
  key: string;
  name: string;
  kind: string;
  sport: string;
  place: string;
  status: string;
  extra: string;
  href: string;
  affiliation: string;
}

/** "public" shows only what anyone may see (clubs, facilities); "staff" is the full register inside the console. */
const PUBLIC_TABS: DirectoryTab[] = ["clubs", "facilities"];

export function DirectoryView({ initialTab = "players", scope = "staff" }: { initialTab?: DirectoryTab; scope?: "public" | "staff" }) {
  const { state, admin } = useStore();
  const qs = useSearchParams();
  const [tab, setTab] = useState<DirectoryTab>(scope === "public" && !PUBLIC_TABS.includes(initialTab) ? "clubs" : initialTab);
  const [q, setQ] = useState(qs.get("q") ?? "");
  const [county, setCounty] = useState("");
  const [sport, setSport] = useState("");
  const [affil, setAffil] = useState("");
  const [page, setPage] = useState(0);
  const [people, setPeople] = useState<{ rows: Row[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const staffView = scope === "staff";
  const tabs = staffView ? (Object.keys(LABEL) as DirectoryTab[]) : PUBLIC_TABS;
  const allowed = true;

  // Load people from the server (scoped to what this account may see), debounced for typing.
  useEffect(() => {
    if (tab === "facilities" || !allowed) return;
    const publicClubs = tab === "clubs" && !staffView;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      const p = new URLSearchParams({ tab, q, county, sport, club: affil });
      api<{ rows: { affiliation?: string; id: string; name: string; type: string; role?: string | null; sport: string; county: string; subCounty: string; ward: string; status: string; certificateNo: string | null }[]; total: number }>(publicClubs ? `/clubs?${p}` : `/directory?${p}`)
        .then((r) => {
          if (cancelled) return;
          setErr("");
          setPeople({
            total: r.total,
            rows: r.rows.map((x) => ({
              key: x.id,
              name: x.name,
              kind: x.role ?? x.type,
              sport: SPORT_BY_ID[x.sport]?.name ?? x.sport,
              place: [x.ward, x.subCounty, x.county].filter(Boolean).join(", "),
              status: x.status,
              extra: x.certificateNo ?? "",
              affiliation: x.affiliation ?? "",
              href: x.certificateNo ? `/verify?no=${encodeURIComponent(x.certificateNo)}` : "",
            })),
          });
        })
        .catch((e) => !cancelled && setErr(errText(e)))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tab, q, county, sport, affil, allowed, staffView]);

  const facilityRows: Row[] = useMemo(() => {
    if (tab !== "facilities") return [];
    const n = q.trim().toLowerCase();
    return state.facilities
      .filter((f) => (!county || f.place.countyId === county) && (!sport || f.sports.includes(sport)) &&
        (!n || `${f.name} ${f.type} ${formatPlace(f.place)}`.toLowerCase().includes(n)))
      .map((f) => ({
        key: f.id, name: f.name, kind: f.type,
        sport: f.sports.map((s) => SPORT_BY_ID[s]?.name).filter(Boolean).join(", ") || "—",
        place: formatPlace(f.place), status: f.status === "Verified" ? "Verified" : "Unverified", extra: f.id, affiliation: "",
        href: `/facilities?focus=${encodeURIComponent(f.id)}`,
      }));
  }, [tab, q, county, sport, state.facilities]);

  const rows = tab === "facilities" ? facilityRows : (people?.rows ?? []);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-24">
      <div className="-mt-8 rounded-2xl border border-line bg-white p-5 shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)] sm:p-7">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => reset(() => { setTab(t); setPeople(null); setAffil(""); })}
              aria-pressed={tab === t}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold transition ${tab === t ? "bg-forest-800 text-white" : "bg-bone text-ink-2 hover:bg-forest-100"}`}
            >
              {LABEL[t]}
            </button>
          ))}
        </div>

        {(
          <>
            <div className={`mt-5 grid gap-3 ${tab === "players" && staffView ? "md:grid-cols-[1fr_200px_200px_200px]" : "md:grid-cols-[1fr_220px_200px]"}`}>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input className={`${inputCls} pl-10`} placeholder="Search names, clubs, sports, places…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
              </div>
              <select className={inputCls} value={county} onChange={(e) => reset(() => setCounty(e.target.value))} aria-label="County">
                <option value="">All counties</option>
                {admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
              </select>
              <select className={inputCls} value={sport} onChange={(e) => reset(() => setSport(e.target.value))} aria-label="Sport">
                <option value="">Any sport</option>
                {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {tab === "players" && staffView && (
                <select className={inputCls} value={affil} onChange={(e) => reset(() => setAffil(e.target.value))} aria-label="Club affiliation">
                  <option value="">Club and independent</option>
                  <option value="any">With a club</option>
                  <option value="none">Independent (no club)</option>
                </select>
              )}
            </div>

            {err && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-kenya-red-deep">{err}</p>}
            {loading && !people && tab !== "facilities" ? (
              <BlockLoader label="Loading the register" />
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-3">
                      <th className="py-3 pr-4 font-semibold">Name</th><th className="py-3 pr-4 font-semibold">{tab === "players" ? "Role" : "Type"}</th>
                      {tab === "players" && <th className="py-3 pr-4 font-semibold">Club</th>}
                      <th className="py-3 pr-4 font-semibold">Sport</th><th className="py-3 pr-4 font-semibold">Location</th>
                      <th className="py-3 pr-4 font-semibold">Status</th><th className="py-3 font-semibold">{tab === "facilities" ? "ID" : "Certificate"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.map((r) => (
                      <tr key={r.key} className="border-b border-line/70 transition hover:bg-bone/70">
                        <td className="py-3.5 pr-4 font-semibold">{r.href ? <Link href={r.href} className="hover:text-forest-700 hover:underline">{r.name}</Link> : r.name}</td>
                        <td className="py-3.5 pr-4 text-ink-2">{r.kind}</td>
                        {tab === "players" && <td className="py-3.5 pr-4 text-ink-2">{r.affiliation}</td>}
                        <td className="py-3.5 pr-4 text-ink-2">{r.sport}</td>
                        <td className="py-3.5 pr-4 text-ink-2">{r.place}</td>
                        <td className="py-3.5 pr-4"><Pill>{r.status}</Pill></td>
                        <td className="py-3.5 font-mono text-xs text-ink-3">{r.extra || "—"}</td>
                      </tr>
                    ))}
                    {view.length === 0 && (
                      <tr><td colSpan={7} className="py-14 text-center text-ink-3"><MapPin className="mx-auto mb-2" size={22} />No matching records.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-2">
              <p className="flex items-center gap-2 text-xs text-ink-3">
                <ShieldCheck size={14} /> {tab === "facilities" || (tab === "clubs" && !staffView) ? "Public register of verified organisations. No personal data or rosters are shown." : "Restricted to your scope. ID, KRA PIN, phone and email are never shown here."}
              </p>
              <div className="flex items-center gap-2">
                <span>{rows.length === 0 ? 0 : page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length.toLocaleString()}</span>
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page" className="grid h-9 w-9 place-items-center rounded-full border border-line disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Next page" className="grid h-9 w-9 place-items-center rounded-full border border-line disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
