"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BadgeCheck, CalendarDays, Camera, Check, ChevronRight, ClipboardList, Download, FileText, Landmark, LifeBuoy, LogOut, MapPinned, Plus, RefreshCw, Search, Users, Wallet } from "lucide-react";
import { SPORT_BY_ID } from "@/data/sports";
import { formatPlace } from "@/lib/admin";
import { api } from "@/lib/api";
import { errText, useStore } from "@/lib/store";
import type { Application } from "@/lib/types";
import { DocumentsPanel } from "./DocumentsPanel";
import { MediaPanel } from "./MediaPanel";
import { NotificationList } from "./NotificationList";
import { PayBox } from "./PayBox";
import { ORG_TYPES } from "./RegistrationFlow";
import { Field, inputCls } from "./ui/Field";
import { Pill } from "./ui/Pill";
import { ButtonSpinner } from "./ui/Spinner";

const STATUS_ACCENT: Record<string, string> = {
  Approved: "border-t-leaf",
  Rejected: "border-t-kenya-red",
  Suspended: "border-t-kenya-red",
  "Needs info": "border-t-gold",
};

function Tile({ icon, label, value, hint, tone = "forest" }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; tone?: "forest" | "leaf" | "gold" | "red" }) {
  const tones = { forest: "bg-forest-100 text-forest-800", leaf: "bg-leaf/15 text-leaf", gold: "bg-gold-soft text-forest-900", red: "bg-red-50 text-kenya-red" };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-[0_18px_40px_-34px_rgba(6,45,87,0.6)]">
      <span className={`hidden h-11 w-11 shrink-0 place-items-center rounded-xl min-[420px]:grid ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{label}</p>
        <p className="text-lg font-bold leading-tight text-forest-900 sm:text-xl">{value}</p>
        {hint && <p className="text-xs leading-snug text-ink-3">{hint}</p>}
      </div>
    </div>
  );
}

export function AccountView() {
  const { me, member, state, logout } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!me) router.replace("/login");
    else if (me.staff) router.replace("/console");
    else if (me.mustChangePassword) router.replace("/security");
  }, [me, router]);
  if (!member) return null;

  const club = state.club;
  const mine = state.applications.filter((a) => !a.clubId);
  const all = state.applications;
  const approved = all.filter((a) => a.status === "Approved").length;
  const due = all.filter((a) => a.payment.status === "Pending").reduce((n, a) => n + a.payment.amount, 0);
  const needsYou = all.filter((a) => a.status === "Needs info" || (a.mediaRequest && !a.mediaRequest.fulfilledAt)).length;
  const roster = club ? all.filter((a) => a.clubId === club.id) : [];
  const first = member.name.trim().split(/\s+/)[0];
  const initials = member.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-5 pb-24">
      <header className="relative -mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 p-6 text-white shadow-[0_40px_80px_-50px_rgba(6,45,87,0.8)] print:hidden sm:p-8">
        <div aria-hidden className="pitch-lines absolute inset-0 opacity-30" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gold text-xl font-bold text-forest-950 shadow-[0_14px_28px_-12px_rgba(245,180,0,0.9)]">{initials || "?"}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">{club ? "Verified club account" : "Welcome back"}</p>
              <h2 className="truncate text-xl font-bold sm:text-2xl">{club ? `${first}, ${club.name}` : `Hello, ${first}`}</h2>
              <p className="mt-0.5 truncate text-sm text-white/70">{member.email}{member.phone ? ` · ${member.phone}` : ""}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-forest-950 shadow-[0_14px_28px_-14px_rgba(245,180,0,0.9)] transition hover:brightness-105"><Plus size={16} /> New registration</Link>
            <button onClick={async () => { await logout(); router.push("/"); }} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 print:hidden lg:grid-cols-4">
        <Tile icon={<ClipboardList size={22} />} label="Registrations" value={all.length} hint={club ? `incl. ${roster.length} players` : undefined} />
        <Tile icon={<BadgeCheck size={22} />} label="Verified" value={approved} tone="leaf" />
        <Tile icon={<AlertCircle size={22} />} label="Needs you" value={needsYou} tone={needsYou ? "gold" : "forest"} hint={needsYou ? "Information requested" : "All up to date"} />
        <Tile icon={<Wallet size={22} />} label="Fees due" value={`KSh ${due.toLocaleString()}`} tone={due ? "red" : "forest"} hint={due ? "Pay to start verification" : "Nothing to pay"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {club && <ClubPortal />}

          <section className="print:hidden">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-forest-900"><ClipboardList size={19} /> My registrations</h2>
            {mine.length === 0 && (
              <div className="rounded-2xl border border-dashed border-forest-700/30 bg-white p-8 text-center">
                <p className="font-bold text-forest-900">No registrations yet</p>
                <p className="mt-1 text-sm text-ink-3">Register a player, a club or an organisation to get started.</p>
                <Link href="/register" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest-800 px-5 py-2.5 text-sm font-bold text-white"><Plus size={15} /> Start a registration</Link>
              </div>
            )}
            <div className="grid gap-4 2xl:grid-cols-2">
              {mine.map((a) => <RegistrationCard key={a.id} a={a} />)}
            </div>
          </section>
        </div>

        <aside className="space-y-6 print:hidden xl:sticky xl:top-28">
          <NotificationList />
          <section className="rounded-2xl border border-line bg-white p-5" aria-label="Quick links">
            <h2 className="text-base font-bold text-forest-900">Quick links</h2>
            <ul className="mt-3 grid gap-1.5">
              {[
                ["/clubs", "Find a club", Users],
                ["/federations", "Federations", Landmark],
                ["/facilities", "Facilities map", MapPinned],
                ["/events", "Upcoming events", CalendarDays],
                ["/verify", "Verify a certificate", BadgeCheck],
                ["/contact", "Contact the Ministry", LifeBuoy],
              ].map(([href, label, Icon]) => {
                const I = Icon as typeof Users;
                return (
                  <li key={href as string}>
                    <Link href={href as string} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-forest-900 transition hover:bg-bone">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-forest-100 text-forest-800 transition group-hover:bg-forest-800 group-hover:text-white"><I size={16} /></span>
                      {label as string}
                      <ChevronRight size={15} className="ml-auto text-ink-3 transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RegistrationCard({ a }: { a: Application }) {
  const [nowMs] = useState(() => Date.now());
  const { resubmit, renew, appeal, state: appState } = useStore();
  const fed = appState.federations.find((f) => f.sportId === a.sport);
  const [docs, setDocs] = useState(false);
  const [appealNote, setAppealNote] = useState("");
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const sport = SPORT_BY_ID[a.sport];
  const waiting = a.status === "Needs info";
  const last = a.history[a.history.length - 1];

  return (
    <article className={`rounded-2xl border border-line border-t-4 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(6,45,87,0.6)] ${STATUS_ACCENT[a.status] ?? "border-t-forest-700"}`}>
      <div className="flex items-start justify-between gap-3">
        {a.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-forest-900">{a.clubName || a.name}</h3>
          <p className="text-xs text-ink-3">{a.type} · {sport?.name} · {formatPlace(a.place)}</p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-3">{a.id}</p>
          {(fed || a.federation) && (
            <p className="mt-1 text-xs text-ink-2">
              Federation: <b>{fed?.name ?? a.federation}</b>
              {fed?.contactEmail && <> · <a className="font-semibold text-forest-700 hover:underline" href={`mailto:${fed.contactEmail}`}>{fed.contactEmail}</a></>}
            </p>
          )}
        </div>
        <Pill>{a.status}</Pill>
      </div>

      <ol className="mt-5 flex items-start" aria-label="Progress">
        {["Submitted", "Under review", "Endorsed", "Approved"].map((st, i) => {
          const order = ["Submitted", "Under review", "Needs info", "Endorsed", "Approved"];
          const reached = order.indexOf(a.status) >= order.indexOf(st) || a.status === "Suspended";
          const current = a.status === st || (a.status === "Needs info" && st === "Under review");
          return (
            <li key={st} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span aria-hidden className={`absolute right-1/2 top-[13px] h-[3px] w-full ${reached ? "bg-leaf" : "bg-line"}`} />}
              <span className={`relative grid h-[27px] w-[27px] place-items-center rounded-full text-[11px] font-bold ${reached ? "bg-leaf text-white" : "bg-line text-ink-3"} ${current ? "ring-4 ring-leaf/20" : ""}`}>
                {reached && !current ? <Check size={14} strokeWidth={3.5} /> : i + 1}
              </span>
              <span className={`mt-1.5 text-[11px] font-semibold leading-tight ${reached ? "text-forest-900" : "text-ink-3"}`}>{st}</span>
            </li>
          );
        })}
      </ol>
      {last?.note && <p className="mt-3 rounded-lg bg-bone px-3 py-2 text-sm text-ink-2">“{last.note}” — {last.by}</p>}
      {a.mediaRequest && !a.mediaRequest.fulfilledAt && (
        <div className="mt-3 rounded-lg border border-gold bg-gold-soft p-3 text-sm">
          <p className="font-bold text-forest-900">{a.mediaRequest.role} asked for a trial video</p>
          {a.mediaRequest.note && <p className="mt-0.5 text-ink-2">“{a.mediaRequest.note}”</p>}
          <button onClick={() => setMedia(true)} className="mt-2 text-sm font-bold text-forest-800 underline underline-offset-4">Upload it now</button>
          <span className="ml-2 text-xs text-ink-3">Your registration is not held up by this.</span>
        </div>
      )}

      {a.payment.status === "Pending" && (
        <>
          <p className="mt-3 text-sm font-semibold text-kenya-red-deep">
            {a.renewing ? "Renewal" : "Registration"} fee of KSh {a.payment.amount.toLocaleString()} is unpaid.{a.renewing ? "" : " Verification starts after payment."}
          </p>
          <PayBox ids={[a.id]} amount={a.payment.amount} defaultPhone={a.phone} />
        </>
      )}

      {a.evidenceNeeded && (
        <div className="mt-3 rounded-lg border border-gold bg-gold-soft p-3 text-sm">
          <p className="font-bold text-forest-900">A trial video is needed for approval</p>
          <p className="mt-0.5 text-ink-2">{a.level} players registering individually need a trial video, unless your federation endorses you. Upload one, or wait for endorsement.</p>
          <button onClick={() => setMedia(true)} className="mt-2 text-sm font-bold text-forest-800 underline underline-offset-4">Upload a trial video</button>
        </div>
      )}
      {a.status === "Approved" && a.expiresAt && (
        <p className="mt-3 text-sm text-ink-2">
          Certificate valid until <b>{new Date(a.expiresAt).toLocaleDateString("en-KE", { dateStyle: "long" })}</b>.
          {!a.renewing && new Date(a.expiresAt).getTime() - nowMs < 60 * 86_400_000 && (
            <button onClick={() => renew(a.id)} className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-forest-950"><RefreshCw size={13} /> Renew now</button>
          )}
        </p>
      )}
      {(a.status === "Rejected" || a.status === "Suspended") && (
        <div className="mt-3 rounded-lg border border-line bg-bone p-3">
          {a.appeal ? (
            <p className="text-sm font-semibold text-forest-900">Your appeal is with the Registrar. You will be notified of the outcome.</p>
          ) : (
            <>
              <p className="text-sm font-bold text-forest-900">Disagree with this decision? You can appeal.</p>
              <textarea className={`${inputCls} mt-2 min-h-[70px]`} placeholder="Explain what has changed or why the decision should be reviewed" value={appealNote} onChange={(e) => { setAppealNote(e.target.value); setErr(""); }} />
              <button onClick={async () => { try { await appeal(a.id, appealNote); setAppealNote(""); } catch (e) { setErr(errText(e)); } }} className="mt-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white">Lodge appeal</button>
              {err && <p role="alert" className="mt-2 text-xs font-semibold text-kenya-red">{err}</p>}
            </>
          )}
        </div>
      )}
      {waiting && (
        <div className="mt-3">
          <Field label="What have you updated or supplied?" error={err}>
            <textarea className={`${inputCls} min-h-[70px]`} value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} />
          </Field>
          <button
            onClick={async () => { try { await resubmit(a.id, note); setNote(""); } catch (e) { setErr(errText(e)); } }}
            className="mt-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white"
          >Send back for review</button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {a.status === "Approved" && a.certificateNo && (
          <a href={`/api/applications/${a.id}/certificate.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white"><Download size={16} /> Certificate (PDF)</a>
        )}
        {ORG_TYPES.includes(a.type) && (
          <button onClick={() => setDocs((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2.5 text-sm font-bold text-forest-800 hover:bg-bone">
            <FileText size={15} /> Documents {["Club", "Federation / Association", "County Branch"].includes(a.type) && a.status !== "Approved" && <span className="text-xs font-semibold text-kenya-red">(required)</span>}
          </button>
        )}
        {a.type === "Player / Sportsperson" && a.status !== "Rejected" && (
          <button onClick={() => setMedia((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2.5 text-sm font-bold text-forest-800 hover:bg-bone">
            <Camera size={15} /> Photos &amp; trial videos <span className="text-xs font-semibold text-ink-3">(optional)</span>
          </button>
        )}
        <button onClick={() => setOpen((o) => !o)} className="text-sm font-bold text-forest-700 underline underline-offset-4">{open ? "Hide history" : "Show history"}</button>
      </div>
      {media && <div className="mt-4 border-t border-line pt-4"><MediaPanel applicationId={a.id} canEdit /></div>}
      {docs && <div className="mt-4 border-t border-line pt-4"><DocumentsPanel applicationId={a.id} canEdit /></div>}
      {open && (
        <ol className="mt-3 space-y-3 border-l border-line pl-5">
          {[...a.history].reverse().map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-forest-700 ring-4 ring-white" />
              <p className="text-sm font-semibold">{h.action}</p>
              <p className="text-xs text-ink-3">{h.by} · {h.role} · {new Date(h.at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
              {h.note && <p className="mt-1 text-sm text-ink-2">“{h.note}”</p>}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function ClubPortal() {
  const [nowMs] = useState(() => Date.now());
  const { state, addClubPlayer, notify, refresh } = useStore();
  const club = state.club!;
  const toggleListing = async (a: Application) => {
    try {
      await api(`/applications/${a.id}/listing`, "POST", { listed: !a.publicListed });
      await refresh();
    } catch (x) {
      notify(errText(x), "error");
    }
  };
  const roster = useMemo(() => state.applications.filter((a) => a.clubId === club.id), [state.applications, club.id]);
  const pending = roster.filter((a) => a.payment.status === "Pending");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", idNo: "", phone: "", kra: "", level: "Amateur", sport: club.sport, dob: "", gender: "", gName: "", gPhone: "", gRel: "", gConsent: false, listed: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [adding, setAdding] = useState(false);
  const [mediaFor, setMediaFor] = useState<string | null>(null);

  const shown = roster.filter((a) => !q.trim() || `${a.name} ${a.idNo} ${a.status}`.toLowerCase().includes(q.trim().toLowerCase()));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const young = form.dob && nowMs - new Date(form.dob).getTime() < 18 * 365.25 * 86_400_000;
      const p = await addClubPlayer({
        name: form.name, idNo: form.idNo, phone: form.phone, kra: form.kra, level: form.level, sport: form.sport, hasContract: "No",
        dob: form.dob, gender: form.gender, publicListing: form.listed,
        guardian: young ? { name: form.gName, phone: form.gPhone, relationship: form.gRel, consent: form.gConsent } : undefined,
      });
      notify(`${p.name} added. Pay the registration fee to send them for verification.`);
      setAdding(false);
      setForm({ ...form, name: "", idNo: "", phone: "", kra: "", dob: "", gender: "", gName: "", gPhone: "", gRel: "", gConsent: false });
    } catch (x) {
      setErr(errText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_50px_-34px_rgba(6,45,87,0.6)] print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-gradient-to-r from-forest-100/70 to-white p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-forest-800 text-white"><Users size={22} /></span>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-leaf"><BadgeCheck size={14} /> Verified club</p>
            <h2 className="text-lg font-bold text-forest-900 sm:text-xl">{club.name}: player roster</h2>
            <p className="text-[13px] text-ink-3">Players you add are verified by the county office and the Registrar before they appear on the national record.</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-forest-100 px-3.5 py-1.5 text-sm font-bold text-forest-800">{roster.length} player{roster.length === 1 ? "" : "s"}</span>
          <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-forest-900">
            <Plus size={16} className={`transition ${adding ? "rotate-45" : ""}`} /> {adding ? "Close" : "Add a player"}
          </button>
        </div>
      </div>
      <div className="p-5 sm:p-6">
      {adding && <form onSubmit={add} className="step-anim mb-5 grid gap-3 rounded-xl border border-line bg-bone p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Player's full names" required className="lg:col-span-2">
          <input className={inputCls} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr(""); }} />
        </Field>
        <Field label="ID / birth cert. / passport no." required>
          <input className={inputCls} value={form.idNo} onChange={(e) => { setForm({ ...form, idNo: e.target.value }); setErr(""); }} />
        </Field>
        <Field label="Date of birth" required><input type="date" className={inputCls} max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
        <Field label="Category" required>
          <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Select</option><option>Female</option><option>Male</option>
          </select>
        </Field>
        <Field label="Phone (optional)"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        {form.dob && nowMs - new Date(form.dob).getTime() < 18 * 365.25 * 86_400_000 && (
          <div className="grid gap-3 rounded-lg border border-gold bg-gold-soft p-3 sm:col-span-2 lg:col-span-4 lg:grid-cols-3">
            <Field label="Parent / guardian name" required><input className={inputCls} value={form.gName} onChange={(e) => setForm({ ...form, gName: e.target.value })} /></Field>
            <Field label="Relationship" required><input className={inputCls} value={form.gRel} onChange={(e) => setForm({ ...form, gRel: e.target.value })} /></Field>
            <Field label="Guardian phone" required><input className={inputCls} value={form.gPhone} onChange={(e) => setForm({ ...form, gPhone: e.target.value })} /></Field>
            <label className="flex items-start gap-2.5 text-[13px] lg:col-span-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-forest-700" checked={form.gConsent} onChange={(e) => setForm({ ...form, gConsent: e.target.checked })} />
              <span>The parent or guardian has consented to this player&apos;s registration.</span>
            </label>
          </div>
        )}
        <label className="flex items-start gap-2.5 text-[13px] sm:col-span-2 lg:col-span-4">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-forest-700" checked={form.listed} onChange={(e) => setForm({ ...form, listed: e.target.checked })} />
          <span>List this player on our public club page once verified (name, role and sport only). For under-18s, the guardian agrees to this.</span>
        </label>
        <Field label="Sport">
          <select className={inputCls} value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
            {Object.values(SPORT_BY_ID).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Level">
          <select className={inputCls} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            {["Professional", "Semi-Professional", "Amateur", "Youth / Junior", "Community"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <div className="flex items-end sm:col-span-2">
          <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-forest-800 to-forest-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-80 sm:w-auto">
            {busy ? <ButtonSpinner /> : <Plus size={16} />} Add player
          </button>
        </div>
        {err && <p role="alert" className="text-sm font-semibold text-kenya-red sm:col-span-2 lg:col-span-4">{err}</p>}
      </form>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className={`${inputCls} pl-10`} placeholder="Search your roster by name, ID or status…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {pending.length > 0 && (
          <button onClick={() => setPaying((p) => !p)} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-3 text-sm font-bold text-white">
            Pay for {pending.length} unpaid player{pending.length > 1 ? "s" : ""} (KSh {pending.reduce((n, a) => n + a.payment.amount, 0).toLocaleString()})
          </button>
        )}
      </div>
      {paying && pending.length > 0 && (
        <PayBox club ids={pending.map((a) => a.id)} amount={pending.reduce((n, a) => n + a.payment.amount, 0)} defaultPhone={roster[0]?.phone ?? ""} onDone={() => setPaying(false)} />
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-3">
              <th className="py-2.5 pr-3 font-semibold">Player</th><th className="py-2.5 pr-3 font-semibold">ID</th>
              <th className="py-2.5 pr-3 font-semibold">Sport</th><th className="py-2.5 pr-3 font-semibold">Payment</th><th className="py-2.5 pr-3 font-semibold">Verification</th><th className="py-2.5 pr-3 font-semibold">Public page</th><th className="py-2.5 font-semibold">Media</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.id} className="border-b border-line/70">
                <td className="py-3 pr-3 font-semibold">{a.name}<span className="block font-mono text-[11px] font-normal text-ink-3">{a.id}</span></td>
                <td className="py-3 pr-3 text-ink-2">{a.idNo}</td>
                <td className="py-3 pr-3 text-ink-2">{SPORT_BY_ID[a.sport]?.name}</td>
                <td className="py-3 pr-3"><Pill>{a.payment.status}</Pill></td>
                <td className="py-3 pr-3"><Pill>{a.status}</Pill></td>
                <td className="py-3 pr-3">
                  <button onClick={() => toggleListing(a)} aria-pressed={!!a.publicListed} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${a.publicListed ? "border-leaf bg-leaf/10 text-leaf" : "border-line text-ink-3 hover:bg-bone"}`}>
                    {a.publicListed ? "Listed" : "Not listed"}
                  </button>
                </td>
                <td className="py-3">
                  <button onClick={() => setMediaFor(mediaFor === a.id ? null : a.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-forest-800 hover:bg-bone">
                    <Camera size={13} /> {mediaFor === a.id ? "Close" : a.mediaRequest && !a.mediaRequest.fulfilledAt ? "Video requested" : "Photos & videos"}
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-ink-3">{roster.length ? "No player matches your search." : "No players yet. Add your first player above."}</td></tr>}
          </tbody>
        </table>
      </div>
      {mediaFor && (
        <div className="mt-4 rounded-xl border border-forest-700/30 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-forest-900">Media for {roster.find((r) => r.id === mediaFor)?.name}</p>
          <MediaPanel key={mediaFor} applicationId={mediaFor} canEdit />
        </div>
      )}
      </div>
    </section>
  );
}
