"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Check, Download, MessageSquareWarning, RotateCcw, Search, ShieldCheck, Stamp, X } from "lucide-react";
import { SPORT_BY_ID, SPORTS } from "@/data/sports";
import { formatPlace } from "@/lib/admin";
import { inScopeApp } from "@/lib/roles";
import { useStore } from "@/lib/store";
import type { Application, AppStatus } from "@/lib/types";
import { BlockLoader } from "@/components/ui/Spinner";
import { Pill } from "@/components/ui/Pill";
import { inputCls } from "@/components/ui/Field";
import { Drawer, NoAccess, PageTitle, downloadCsv } from "@/components/console/ui";
import { MediaPanel } from "@/components/MediaPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { ORG_TYPES } from "@/components/RegistrationFlow";

const STATUSES: AppStatus[] = ["Submitted", "Under review", "Needs info", "Endorsed", "Approved", "Rejected", "Suspended"];

export default function Page() {
  return (
    <Suspense fallback={<BlockLoader label="Loading applications" />}>
      <Applications />
    </Suspense>
  );
}

function Applications() {
  const { state, user, can, bulk } = useStore();
  const qs = useSearchParams();
  const [picked, setPicked] = useState<string[]>([]);
  const [nowMs] = useState(() => Date.now());
  const [status, setStatus] = useState(qs.get("status") ?? "");
  const [sport, setSport] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.applications
      .filter((a) => inScopeApp(user, a))
      .filter((a) => !status || a.status === status)
      .filter((a) => !sport || a.sport === sport)
      .filter((a) => !n || `${a.id} ${a.name} ${a.clubName} ${a.type} ${a.place.county}`.toLowerCase().includes(n));
  }, [state.applications, user, status, sport, q]);

  if (!can("applications.view")) return <NoAccess need="applications.view" />;
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allOn = rows.length > 0 && rows.every((r) => picked.includes(r.id));
  const bulkActions = [
    ...(can("applications.review") ? [{ a: "review", l: "Start review", from: "Submitted" }] : []),
    ...(can("applications.endorse") ? [{ a: "endorse", l: "Endorse", from: "Under review" }] : []),
    ...(can("applications.decide") ? [{ a: "approve", l: "Approve", from: "Under review" }] : []),
  ];
  const current = open ? state.applications.find((a) => a.id === open) : null;

  return (
    <>
      <PageTitle
        title="Applications"
        sub={`${rows.length} of ${state.applications.filter((a) => inScopeApp(user, a)).length} in your scope`}
        action={
          can("reports.export") && (
            <button
              onClick={() =>
                downloadCsv("applications.csv", [
                  ["Reference", "Name", "Type", "Sport", "County", "Sub-county", "Ward", "Status", "Payment", "Certificate", "Submitted"],
                  ...rows.map((a) => [a.id, a.clubName || a.name, a.type, SPORT_BY_ID[a.sport]?.name ?? a.sport, a.place.county, a.place.subCounty, a.place.ward, a.status, a.payment.status, a.certificateNo ?? "", a.createdAt.slice(0, 10)]),
                ])
              }
              className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold hover:bg-bone"
            >
              <Download size={15} /> Export CSV
            </button>
          )
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className={`${inputCls} pl-10`} placeholder="Search reference, name, county…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport">
          <option value="">Any sport</option>
          {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {picked.length > 0 && bulkActions.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-sm text-white">
          <b>{picked.length} selected</b>
          {bulkActions.map((b) => (
            <button key={b.a} onClick={async () => { await bulk(picked, b.a); setPicked([]); }} className="rounded-lg bg-white/15 px-3.5 py-2 font-bold hover:bg-white/25">{b.l}</button>
          ))}
          <button onClick={() => setPicked([])} className="ml-auto text-white/70 underline">Clear</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bone/60 text-xs uppercase tracking-wider text-ink-3">
              <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-forest-700" checked={allOn} onChange={() => setPicked(allOn ? [] : rows.map((r) => r.id))} /></th>
              {["Reference", "Applicant", "Type", "Sport", "Location", "Waiting", "Payment", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} onClick={() => setOpen(a.id)} className="cursor-pointer border-b border-line/70 transition hover:bg-bone/70">
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${a.id}`} className="h-4 w-4 accent-forest-700" checked={picked.includes(a.id)} onChange={() => togglePick(a.id)} /></td>
                <td className="px-4 py-3.5 font-mono text-xs">{a.id}</td>
                <td className="px-4 py-3.5 font-semibold">
                  {a.clubName || a.name}
                  {a.appeal && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">APPEAL</span>}
                  {a.evidenceNeeded && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">NEEDS VIDEO</span>}
                </td>
                <td className="px-4 py-3.5 text-ink-2">{a.type}</td>
                <td className="px-4 py-3.5 text-ink-2">{SPORT_BY_ID[a.sport]?.name}</td>
                <td className="px-4 py-3.5 text-ink-2">{a.place.county}</td>
                <td className={`px-4 py-3.5 text-xs ${["Submitted", "Under review", "Needs info", "Endorsed"].includes(a.status) && nowMs - new Date(a.updatedAt).getTime() > 7 * 86_400_000 ? "font-bold text-kenya-red" : "text-ink-3"}`}>
                  {["Submitted", "Under review", "Needs info", "Endorsed"].includes(a.status) ? `${Math.max(0, Math.floor((nowMs - new Date(a.updatedAt).getTime()) / 86_400_000))} d` : "—"}
                </td>
                <td className="px-4 py-3.5"><Pill>{a.payment.status}</Pill></td>
                <td className="px-4 py-3.5"><Pill>{a.status}</Pill></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-14 text-center text-ink-3">No applications match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={!!current} onClose={() => setOpen(null)} title={current ? current.clubName || current.name : ""} subtitle={current ? `${current.id} · ${current.type}` : ""}>
        {current && <Detail app={current} />}
      </Drawer>
    </>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ink-3">{k}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{v || "—"}</dd>
    </div>
  );
}

function Detail({ app }: { app: Application }) {
  const { can, setStatus, user, requestVideo, cancelVideoRequest, state } = useStore();
  const roles = state.roles;
  const [reqNote, setReqNote] = useState("");
  const mayRequest = can("applications.review") || can("applications.endorse") || can("applications.decide");
  // Data minimisation: federations see membership facts, not personal identifiers.
  const seesPII = user?.role === "registrar" || user?.role === "county_officer" || user?.role === "integrity_officer";
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const act = (status: AppStatus, needNote = false, guard?: string) => {
    if (guard) return setErr(guard);
    if (needNote && !note.trim()) return setErr("A reason is required for this action.");
    setStatus(app.id, status, note.trim() || undefined);
    setNote("");
    setErr("");
  };

  const s = app.status;
  const btn = "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition";
  const actions: React.ReactNode[] = [];

  if (can("applications.review")) {
    if (s === "Submitted") actions.push(<button key="r" className={`${btn} bg-forest-800 text-white hover:bg-forest-700`} onClick={() => act("Under review")}><ShieldCheck size={15} /> Start review</button>);
    if (s === "Under review") actions.push(<button key="n" className={`${btn} bg-orange-100 text-orange-800 hover:bg-orange-200`} onClick={() => act("Needs info", true)}><MessageSquareWarning size={15} /> Request information</button>);
    if (s === "Needs info") actions.push(<button key="b" className={`${btn} bg-forest-800 text-white hover:bg-forest-700`} onClick={() => act("Under review")}><RotateCcw size={15} /> Information received</button>);
  }
  if (can("applications.endorse") && s === "Under review")
    actions.push(<button key="e" className={`${btn} bg-teal-700 text-white hover:bg-teal-800`} onClick={() => act("Endorsed")}><Stamp size={15} /> Endorse membership</button>);
  if (can("applications.decide") && (s === "Under review" || s === "Endorsed")) {
    const unpaid = app.payment.status !== "Paid" ? "Cannot approve: the registration fee has not been paid." : undefined;
    actions.push(<button key="a" className={`${btn} bg-forest-800 text-white hover:bg-forest-700`} onClick={() => act("Approved", false, unpaid)}><Check size={15} /> Approve & issue certificate</button>);
    actions.push(<button key="x" className={`${btn} bg-red-100 text-kenya-red-deep hover:bg-red-200`} onClick={() => act("Rejected", true)}><X size={15} /> Reject</button>);
  }
  if (can("applications.decide") && s === "Rejected")
    actions.push(<button key="o" className={`${btn} bg-forest-800 text-white hover:bg-forest-700`} onClick={() => act("Under review", true)}><RotateCcw size={15} /> Reopen for review</button>);
  if (can("records.suspend")) {
    if (s === "Approved") actions.push(<button key="s" className={`${btn} bg-red-100 text-kenya-red-deep hover:bg-red-200`} onClick={() => act("Suspended", true)}><Ban size={15} /> Suspend</button>);
    if (s === "Suspended") actions.push(<button key="u" className={`${btn} bg-forest-800 text-white hover:bg-forest-700`} onClick={() => act("Approved", true)}><RotateCcw size={15} /> Reinstate</button>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2"><Pill>{app.status}</Pill><Pill>{app.payment.status}</Pill></div>

      <dl className="grid grid-cols-2 gap-4">
        <Row k={app.orgRegNo !== undefined && app.clubName ? "Contact person" : "Applicant"} v={app.name} />
        {app.orgRegNo && <Row k="Registration no." v={app.orgRegNo} />}
        <Row k="Sport" v={app.sport === "other" && app.sportOther ? `Other: ${app.sportOther}` : SPORT_BY_ID[app.sport]?.name} />
        {app.roleName && <Row k="Role" v={app.roleName} />}
        <Row k="Federation" v={app.federation} />
        <Row k="Level" v={app.level || undefined} />
        {app.address && <Row k="Head office" v={app.address} />}
        <Row k="Location" v={formatPlace(app.place)} />
        <Row k="GPS" v={app.gps ? `${app.gps.lat.toFixed(5)}, ${app.gps.lon.toFixed(5)}` : undefined} />
        <Row k={app.clubName ? "Contact person's ID / Passport" : "National ID / Passport"} v={seesPII ? app.idNo : "Restricted for your role"} />
        <Row k="KRA PIN" v={seesPII ? app.kra : "Restricted for your role"} />
        <Row k="Phone" v={seesPII ? app.phone : "Restricted for your role"} />
        <Row k="Email" v={seesPII ? app.email : "Restricted for your role"} />
        {app.dob && <Row k="Date of birth" v={app.dob} />}
        {app.gender && <Row k="Category" v={app.gender} />}
        {app.expiresAt && <Row k="Valid until" v={app.expiresAt.slice(0, 10)} />}
        {app.hasContract && <Row k="Player contract" v={app.hasContract} />}
        {app.certificateNo && <Row k="Certificate" v={app.certificateNo} />}
        {app.payment.status === "Paid" && <Row k="Receipt" v={`${app.payment.receipt} · ${app.payment.method}`} />}
      </dl>

      {app.clubOfficials && app.clubOfficials.length > 0 && (
        <div className="rounded-xl border border-line bg-bone/60 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Club officials</p>
          <ul className="divide-y divide-line">
            {app.clubOfficials.map((o, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-sm">
                <span className="font-semibold">{o.name}</span>
                <span className="text-ink-3">{roles.find((r) => r.id === o.role)?.name ?? o.role}{o.phone ? ` · ${o.phone}` : ""}{o.email ? ` · ${o.email}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {app.guardian && (
        <div className="rounded-xl border border-gold bg-gold-soft p-4 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Parent / guardian (player under 18)</p>
          <p className="font-semibold">{app.guardian.name} · {app.guardian.relationship}</p>
          <p className="text-ink-2">{app.guardian.phone} · consent given</p>
        </div>
      )}
      {app.appeal && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-800">Appeal lodged {new Date(app.appeal.at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
          <p className="text-ink-2">“{app.appeal.note}”</p>
        </div>
      )}
      {ORG_TYPES.includes(app.type) && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Documents {["Club", "Federation / Association", "County Branch"].includes(app.type) && "(required for approval)"}</p>
          <DocumentsPanel applicationId={app.id} canEdit={false} />
        </div>
      )}
      {app.notes && <p className="rounded-xl bg-bone px-4 py-3 text-sm text-ink-2">{app.notes}</p>}

      {actions.length > 0 ? (
        <div className="rounded-2xl border border-line p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Your actions</p>
          <textarea
            className={`${inputCls} min-h-[72px] resize-y text-sm`}
            placeholder="Note or reason (required to reject, suspend or request information)"
            value={note}
            onChange={(e) => { setNote(e.target.value); setErr(""); }}
          />
          {err && <p className="mt-2 text-xs font-medium text-kenya-red">{err}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
        </div>
      ) : (
        <p className="rounded-xl bg-bone px-4 py-3 text-sm text-ink-3">No action is available for your role at this stage.</p>
      )}

      {app.type === "Player / Sportsperson" && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Photos &amp; trial videos <span className="font-normal normal-case">(optional for the player)</span></p>
          {app.mediaRequest ? (
            <div className={`mb-3 rounded-xl border p-3.5 text-sm ${app.mediaRequest.fulfilledAt ? "border-leaf/30 bg-leaf-soft" : "border-gold bg-gold-soft"}`}>
              <p className="font-bold">{app.mediaRequest.fulfilledAt ? "Trial video supplied" : "Trial video requested, waiting for the player"}</p>
              <p className="mt-0.5 text-ink-2">
                {app.mediaRequest.by} · {new Date(app.mediaRequest.at).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                {app.mediaRequest.note && <> — “{app.mediaRequest.note}”</>}
              </p>
              {mayRequest && !app.mediaRequest.fulfilledAt && (
                <button onClick={() => cancelVideoRequest(app.id)} className="mt-2 text-xs font-bold underline underline-offset-4">Cancel request</button>
              )}
            </div>
          ) : mayRequest ? (
            <div className="mb-3 rounded-xl border border-line bg-bone p-3.5">
              <p className="text-sm text-ink-2">Not required for approval. Ask the player for a clip only if you need to assess them.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input className={`${inputCls} min-w-[200px] flex-1 py-2.5`} placeholder="What should the video show? (optional)" value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
                <button onClick={async () => { if (await requestVideo(app.id, reqNote)) setReqNote(""); }} className="rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white">Request trial video</button>
              </div>
            </div>
          ) : null}
          <MediaPanel applicationId={app.id} canEdit={false} />
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">History</p>
        <ol className="space-y-4 border-l border-line pl-5">
          {[...app.history].reverse().map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-forest-600 ring-4 ring-paper" />
              <p className="text-sm font-semibold">{h.action}</p>
              <p className="text-xs text-ink-3">{h.by} · {h.role} · {new Date(h.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
              {h.note && <p className="mt-1 text-sm text-ink-2">“{h.note}”</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
