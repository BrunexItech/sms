"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Search, X } from "lucide-react";
import { SPORT_BY_ID } from "@/data/sports";
import { formatPlace } from "@/lib/admin";
import { inScopeFacility } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { CONDITIONS, OWNERSHIP, type Condition, type Facility } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";
import { inputCls } from "@/components/ui/Field";
import { Drawer, NoAccess, PageTitle, downloadCsv } from "@/components/console/ui";

export default function Page() {
  const { state, user, can } = useStore();
  const [status, setStatus] = useState("Unverified");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE = 20;

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.facilities
      .filter((f) => inScopeFacility(user, f))
      .filter((f) => !status || f.status === status)
      .filter((f) => !n || `${f.name} ${f.id} ${formatPlace(f.place)}`.toLowerCase().includes(n));
  }, [state.facilities, user, status, q]);

  if (!can("facilities.verify")) return <NoAccess need="facilities.verify" />;
  const current = open ? state.facilities.find((f) => f.id === open) : null;
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  return (
    <>
      <PageTitle
        title="Facilities"
        sub="Verify records, correct details and log inspections. OpenStreetMap imports start as unverified."
        action={
          can("reports.export") && (
            <button
              onClick={() => downloadCsv("facilities.csv", [["ID", "Name", "Type", "County", "Sub-county", "Ward", "Lat", "Lon", "Status", "Condition", "Source"], ...rows.map((f) => [f.id, f.name, f.type, f.place.county, f.place.subCounty, f.place.ward, f.gps.lat, f.gps.lon, f.status, f.condition ?? "", f.source])])}
              className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold hover:bg-bone"
            >
              Export CSV
            </button>
          )
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className={`${inputCls} pl-10`} placeholder="Search facilities…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
          <option value="">Any status</option>
          <option>Unverified</option>
          <option>Verified</option>
          <option>Rejected</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bone/60 text-xs uppercase tracking-wider text-ink-3">
              {["Facility", "Type", "Location", "Source", "Condition", "Status"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {view.map((f) => (
              <tr key={f.id} onClick={() => setOpen(f.id)} className="cursor-pointer border-b border-line/70 hover:bg-bone/70">
                <td className="px-4 py-3.5 font-semibold">{f.name}<span className="block font-mono text-[11px] font-normal text-ink-3">{f.id}</span></td>
                <td className="px-4 py-3.5 text-ink-2">{f.type}</td>
                <td className="px-4 py-3.5 text-ink-2">{formatPlace(f.place)}</td>
                <td className="px-4 py-3.5 text-ink-2">{f.source}</td>
                <td className="px-4 py-3.5">{f.condition ? <Pill>{f.condition}</Pill> : <span className="text-ink-3">—</span>}</td>
                <td className="px-4 py-3.5"><Pill>{f.status}</Pill></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-14 text-center text-ink-3">No facilities match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-ink-2">
        <span>{rows.length.toLocaleString()} facilities</span>
        <div className="flex items-center gap-2">
          <button className="rounded-full border border-line px-4 py-1.5 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>{page + 1} / {pages}</span>
          <button className="rounded-full border border-line px-4 py-1.5 disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      <Drawer open={!!current} onClose={() => setOpen(null)} title={current?.name ?? ""} subtitle={current ? `${current.id} · ${current.type}` : ""}>
        {current && <FacilityDetail f={current} />}
      </Drawer>
    </>
  );
}

function FacilityDetail({ f }: { f: Facility }) {
  const { setFacilityStatus, addInspection, updateFacility } = useStore();
  const [note, setNote] = useState("");
  const [cond, setCond] = useState<Condition>(f.condition ?? "Good");
  const [err, setErr] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex gap-2"><Pill>{f.status}</Pill>{f.condition && <Pill>{f.condition}</Pill>}</div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-[11px] uppercase tracking-wider text-ink-3">Location</dt><dd className="font-medium">{formatPlace(f.place)}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wider text-ink-3">GPS</dt><dd className="font-mono text-xs">{f.gps.lat.toFixed(5)}, {f.gps.lon.toFixed(5)}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wider text-ink-3">Source</dt><dd className="font-medium">{f.source}</dd></div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-ink-3">Sports</dt>
          <dd className="font-medium">{f.sports.map((s) => SPORT_BY_ID[s]?.name).join(", ") || "Not specified"}</dd>
        </div>
      </dl>
      <a className="inline-block text-sm font-semibold text-forest-700 underline underline-offset-4" href={`https://www.openstreetmap.org/?mlat=${f.gps.lat}&mlon=${f.gps.lon}#map=17/${f.gps.lat}/${f.gps.lon}`} target="_blank" rel="noreferrer">
        Open location in OpenStreetMap
      </a>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Capacity</span>
          <input className={inputCls} inputMode="numeric" defaultValue={f.capacity ?? ""} onBlur={(e) => updateFacility(f.id, { capacity: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Ownership</span>
          <select className={inputCls} value={f.ownership ?? ""} onChange={(e) => updateFacility(f.id, { ownership: e.target.value })}>
            <option value="">Unknown</option>
            {OWNERSHIP.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-line p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Verification & inspection</p>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <select className={inputCls} value={cond} onChange={(e) => setCond(e.target.value as Condition)} aria-label="Condition">
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className={inputCls} placeholder="Inspection note or reason" value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} />
        </div>
        {err && <p className="mt-2 text-xs font-medium text-kenya-red">{err}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => { if (!note.trim()) return setErr("Add an inspection note."); addInspection(f.id, cond, note.trim()); setNote(""); }}
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:bg-bone"
          >
            <ClipboardCheck size={15} /> Log inspection
          </button>
          {f.status !== "Verified" && (
            <button onClick={() => { setFacilityStatus(f.id, "Verified", note.trim() || undefined); setNote(""); }} className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">
              <Check size={15} /> Verify
            </button>
          )}
          {f.status !== "Rejected" && (
            <button onClick={() => { if (!note.trim()) return setErr("A reason is required to reject."); setFacilityStatus(f.id, "Rejected", note.trim()); setNote(""); }} className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2.5 text-sm font-semibold text-kenya-red-deep hover:bg-red-200">
              <X size={15} /> Reject
            </button>
          )}
        </div>
      </div>

      {f.inspections.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Inspections</p>
          <ul className="space-y-3">
            {f.inspections.map((i, k) => (
              <li key={k} className="rounded-xl bg-bone px-4 py-3 text-sm">
                <div className="flex items-center justify-between"><Pill>{i.condition}</Pill><span className="text-xs text-ink-3">{new Date(i.at).toLocaleDateString("en-KE", { dateStyle: "medium" })} · {i.by}</span></div>
                <p className="mt-2 text-ink-2">{i.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
