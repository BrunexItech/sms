"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { SPORT_BY_ID } from "@/data/sports";
import { errText, useStore } from "@/lib/store";
import { BlockLoader, ButtonSpinner } from "@/components/ui/Spinner";
import { inputCls } from "@/components/ui/Field";
import { COMPETITION_LEVELS } from "@/lib/types";
import { SPORTS } from "@/data/sports";
import { NoAccess, PageTitle } from "@/components/console/ui";

interface Ev { id: string; name: string; sport: string; date: string; venue: string; county: string; organiser: string; level: string }

export default function Page() {
  const { can, notify, refresh } = useStore();
  const [rows, setRows] = useState<Ev[] | null>(null);
  const load = useCallback(async () => {
    try {
      setRows((await api<{ events: Ev[] }>("/events/pending")).events);
    } catch (e) {
      notify(errText(e), "error");
      setRows([]);
    }
  }, [notify]);
  useEffect(() => {
    let cancelled = false;
    api<{ events: Ev[] }>("/events/pending").then((r) => !cancelled && setRows(r.events)).catch(() => !cancelled && setRows([]));
    return () => { cancelled = true; };
  }, []);
  if (!can("applications.review") && !can("applications.decide")) return <NoAccess need="applications.review" />;
  const decide = async (id: string, approve: boolean) => {
    const note = approve ? "" : prompt("Reason for declining this event?") ?? "";
    if (!approve && note.trim().length < 3) return;
    try {
      await api(`/events/${id}/decision`, "POST", { approve, note });
      await Promise.all([load(), refresh()]);
      notify(approve ? "Event approved and listed." : "Event declined.");
    } catch (e) {
      notify(errText(e), "error");
    }
  };
  return (
    <>
      <PageTitle title="Event approvals" sub="Events submitted by verified clubs and organisations appear publicly only after approval. The Registrar's office can also publish an official event." />
      {can("applications.decide") && <PublishEvent onDone={() => refresh()} />}
      {!rows ? <BlockLoader label="Loading events" /> : rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-ink-3">No events are waiting for approval.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((e) => (
            <li key={e.id} className="rounded-2xl border border-line bg-white p-5">
              <p className="text-base font-bold text-forest-900">{e.name}</p>
              <p className="mt-1 text-sm text-ink-2">{SPORT_BY_ID[e.sport]?.name} · {e.level} · {new Date(e.date).toLocaleDateString("en-KE", { dateStyle: "full" })}</p>
              <p className="text-sm text-ink-3">{e.venue}, {e.county} · by {e.organiser}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => decide(e.id, true)} className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white"><Check size={15} /> Approve</button>
                <button onClick={() => decide(e.id, false)} className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2.5 text-sm font-bold text-kenya-red-deep"><X size={15} /> Decline</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PublishEvent({ onDone }: { onDone: () => void }) {
  const { admin, notify } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", sport: "", date: "", venue: "", countyId: "", level: "Amateur", organiser: "Ministry of Sports" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/events/official", "POST", f);
      notify("Event published. It is listed publicly now.");
      setF({ ...f, name: "", venue: "", date: "" });
      setOpen(false);
      onDone();
    } catch (x) {
      notify(errText(x), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-forest-900">
        <Plus size={16} className={`transition ${open ? "rotate-45" : ""}`} /> {open ? "Close" : "Publish an official event"}
      </button>
      {open && (
        <form onSubmit={submit} className="step-anim mt-3 grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
          <input className={`${inputCls} lg:col-span-2`} placeholder="Event name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <input className={inputCls} placeholder="Organiser" value={f.organiser} onChange={(e) => setF({ ...f, organiser: e.target.value })} />
          <select className={inputCls} value={f.sport} onChange={(e) => setF({ ...f, sport: e.target.value })} required>
            <option value="">Sport</option>
            {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={inputCls} value={f.countyId} onChange={(e) => setF({ ...f, countyId: e.target.value })} required>
            <option value="">County</option>
            {admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
          </select>
          <select className={inputCls} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            {COMPETITION_LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <input className={inputCls} type="date" min={new Date().toISOString().slice(0, 10)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />
          <input className={`${inputCls} lg:col-span-2`} placeholder="Venue" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} required />
          <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 text-sm font-bold text-white disabled:opacity-70 sm:col-span-2 lg:col-span-3">
            {busy ? <ButtonSpinner /> : <Check size={16} />} Publish event
          </button>
        </form>
      )}
    </div>
  );
}
