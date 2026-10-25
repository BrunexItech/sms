"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { api } from "@/lib/api";
import { SPORT_BY_ID, SPORTS } from "@/data/sports";
import { errText, useStore } from "@/lib/store";
import { Field, inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";

export function EventsView() {
  const { state, admin, member } = useStore();
  const eligible = !!member && state.applications.some((a) => a.status === "Approved" && ["Club", "Academy", "Event Organiser", "Federation / Association", "Sports Business"].includes(a.type));
  const [sport, setSport] = useState("");
  const [county, setCounty] = useState("");
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      [...state.events]
        .filter((e) => (!sport || e.sport === sport) && (!county || e.countyId === county) &&
          (!q.trim() || `${e.name} ${e.venue} ${e.organiser}`.toLowerCase().includes(q.trim().toLowerCase())))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [state.events, sport, county, q],
  );

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-24">
      <div className="-mt-8 rounded-2xl border border-line bg-white p-5 shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)] sm:p-7">
        {eligible && <SubmitEvent />}
        <div className="grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
          <input className={inputCls} placeholder="Search events, venues, organisers…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
          <select className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport">
            <option value="">All sports</option>
            {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={inputCls} value={county} onChange={(e) => setCounty(e.target.value)} aria-label="County">
            <option value="">All counties</option>
            {admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
          </select>
        </div>

        <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => {
            const d = new Date(e.date);
            const s = SPORT_BY_ID[e.sport];
            return (
              <li key={e.id} className="group overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-1 hover:shadow-[0_24px_40px_-26px_rgba(6,45,87,0.6)]">
                <div className="relative h-40">
                  {s && <Image src={s.image} alt={`${s.name}`} fill sizes="(min-width:1280px) 30vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest-950/80 to-transparent" />
                  <div className="absolute left-3 top-3 rounded-lg bg-white px-3 py-1.5 text-center leading-none shadow">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-kenya-red">{d.toLocaleString("en-KE", { month: "short" })}</span>
                    <span className="block text-xl font-bold text-forest-900">{d.getDate()}</span>
                  </div>
                  <span className="absolute bottom-3 left-3 rounded-full bg-gold px-3 py-1 text-[11px] font-bold text-forest-950">{s?.name}</span>
                </div>
                <div className="p-4">
                  <h3 className="text-base font-bold leading-snug text-forest-900">{e.name}</h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
                    <li className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-ink-3" /> {e.venue}, {e.county}</li>
                    <li className="flex gap-2"><CalendarDays size={15} className="mt-0.5 shrink-0 text-ink-3" /> {d.toLocaleDateString("en-KE", { dateStyle: "full" })}</li>
                    <li className="flex gap-2"><Users size={15} className="mt-0.5 shrink-0 text-ink-3" /> {e.organiser} · {e.level}</li>
                  </ul>
                </div>
              </li>
            );
          })}
          {list.length === 0 && <li className="col-span-full py-14 text-center text-ink-3">No upcoming events match.</li>}
        </ul>
        <p className="mt-6 text-xs text-ink-3">Illustrative events for the prototype. Registered event organisers will publish their own events here.</p>
      </div>
    </div>
  );
}

function SubmitEvent() {
  const { admin, notify } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", sport: "football", date: "", venue: "", countyId: "", level: "Amateur" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (f.name.trim().length < 5 || f.venue.trim().length < 3 || !f.date || !f.countyId) return setErr("Fill in the name, date, venue and county.");
    setBusy(true);
    setErr("");
    try {
      await api("/events", "POST", f);
      notify("Event submitted. It will be listed once the Ministry approves it.");
      setOpen(false);
      setF({ ...f, name: "", date: "", venue: "" });
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-6 rounded-xl border border-forest-700/30 bg-forest-100/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-forest-900">You are a verified organisation: you can submit an event.</p>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white">{open ? "Close" : "Submit an event"}</button>
      </div>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Event name" required className="lg:col-span-2"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Date" required><input type="date" className={inputCls} min={new Date().toISOString().slice(0, 10)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Sport"><select className={inputCls} value={f.sport} onChange={(e) => setF({ ...f, sport: e.target.value })}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="County" required><select className={inputCls} value={f.countyId} onChange={(e) => setF({ ...f, countyId: e.target.value })}><option value="">Select</option>{admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}</select></Field>
          <Field label="Venue" required><input className={inputCls} value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field>
          {err && <p role="alert" className="text-sm font-semibold text-kenya-red sm:col-span-2 lg:col-span-3">{err}</p>}
          <div className="sm:col-span-2 lg:col-span-3">
            <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 text-sm font-bold text-forest-950 disabled:opacity-70">{busy && <ButtonSpinner />} Submit for approval</button>
          </div>
        </div>
      )}
    </div>
  );
}
