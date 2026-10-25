"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, ClipboardList, Landmark, MapPinned, Scale, Wallet } from "lucide-react";
import { SPORT_BY_ID } from "@/data/sports";
import { api } from "@/lib/api";
import { ROLE_BY_ID, inScopeApp, inScopeFacility } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { BarList, Card, PageTitle } from "@/components/console/ui";
import { KpiToggle, Ring, StackedBar, TrendChart } from "@/components/console/charts";

const STATUS_COLORS: Record<string, string> = {
  Submitted: "#2f6fc4",
  "Under review": "#d99a00",
  "Needs info": "#e06a1b",
  Endorsed: "#14938a",
  Approved: "#12743f",
  Rejected: "#c8102e",
  Suspended: "#7a3b3b",
};
const DAY = 86_400_000;

function weekStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
const pct = (now: number, prev: number) => (prev === 0 ? (now === 0 ? 0 : 100) : Math.round(((now - prev) / prev) * 100));

export default function ConsoleHome() {
  const { state, user, can } = useStore();
  const [pendingEvents, setPendingEvents] = useState<number | null>(null);
  const [openKpi, setOpenKpi] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const canEvents = !!user && (can("applications.review") || can("applications.decide"));

  useEffect(() => {
    if (!canEvents) return;
    let off = false;
    api<{ events: unknown[] }>("/events/pending").then((r) => !off && setPendingEvents(r.events.length)).catch(() => !off && setPendingEvents(0));
    return () => { off = true; };
  }, [canEvents]);

  const d = useMemo(() => {
    if (!user) return null;
    const apps = can("applications.view") ? state.applications.filter((a) => inScopeApp(user, a)) : [];
    const facs = state.facilities.filter((f) => inScopeFacility(user, f));
    const count = (s: string) => apps.filter((a) => a.status === s).length;
    const tally = (key: (a: (typeof apps)[number]) => string, n = 8) =>
      Object.entries(apps.reduce<Record<string, number>>((m, a) => ((m[key(a)] = (m[key(a)] ?? 0) + 1), m), {}))
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, n);

    // twelve weekly buckets, newest last
    const start = weekStart(nowMs) - 11 * 7 * DAY;
    const labels = Array.from({ length: 12 }, (_, i) => new Date(start + i * 7 * DAY).toLocaleDateString("en-KE", { day: "numeric", month: "short" }));
    const bucket = (t: number) => Math.floor((weekStart(t) - start) / (7 * DAY));
    const submitted = Array(12).fill(0), approvedW = Array(12).fill(0);
    for (const a of apps) {
      const b = bucket(new Date(a.createdAt).getTime());
      if (b >= 0 && b < 12) submitted[b]++;
      if (a.status === "Approved") {
        const at = a.history.find((h) => h.action === "Approved")?.at ?? a.updatedAt;
        const k = bucket(new Date(at).getTime());
        if (k >= 0 && k < 12) approvedW[k]++;
      }
    }
    const inWindow = (from: number, to: number) => apps.filter((a) => { const t = new Date(a.createdAt).getTime(); return t >= from && t < to; }).length;
    const last30 = inWindow(nowMs - 30 * DAY, nowMs + DAY), prev30 = inWindow(nowMs - 60 * DAY, nowMs - 30 * DAY);
    const paid = state.applications.filter((a) => a.payment.status === "Paid");
    return {
      apps, facs, labels, submitted, approvedW, last30, prev30,
      status: Object.keys(STATUS_COLORS).map((label) => ({ label, value: count(label), color: STATUS_COLORS[label] })),
      type: tally((a) => a.type), sport: tally((a) => SPORT_BY_ID[a.sport]?.name ?? a.sport), county: tally((a) => a.place.county),
      count, decision: count("Under review") + count("Endorsed"),
      appeals: apps.filter((a) => a.appeal && ["Rejected", "Suspended"].includes(a.status)).length,
      revenue: paid.reduce((n, a) => n + a.payment.amount, 0),
      outstanding: state.applications.filter((a) => a.payment.status === "Pending").reduce((n, a) => n + a.payment.amount, 0),
      verified: apps.length ? Math.round((count("Approved") / apps.length) * 100) : 0,
      facStatus: ["Verified", "Unverified", "Rejected"].map((s) => ({ label: s, value: facs.filter((f) => f.status === s).length, color: s === "Verified" ? "#12743f" : s === "Unverified" ? "#d99a00" : "#c8102e" })),
    };
  }, [state, user, can, nowMs]);

  if (!user || !d) return null;
  const role = ROLE_BY_ID[user.role];
  const showApps = can("applications.view");
  const showMoney = can("payments.view");

  // Work queue: what this role must act on next (the Registrar's office and admins see all of it).
  const wide = user.role === "super_admin" || user.role === "registrar";
  const queue: { label: string; n: number; href: string }[] = [];
  if (user.role === "county_officer" || wide) queue.push({ label: "New applications to review", n: d.count("Submitted"), href: "/console/applications?status=Submitted" });
  if (user.role === "county_officer") queue.push({ label: "Waiting on applicant information", n: d.count("Needs info"), href: "/console/applications?status=Needs%20info" });
  if (user.role === "federation_admin") queue.push({ label: "Members awaiting your endorsement", n: d.count("Under review"), href: "/console/applications?status=Under%20review" });
  if (wide) queue.push({ label: "Ready for a decision", n: d.decision, href: "/console/applications?status=Under%20review" });
  if (wide) queue.push({ label: "Appeals waiting", n: d.appeals, href: "/console/applications?status=Rejected" });
  if (user.role === "integrity_officer") queue.push({ label: "Currently suspended", n: d.count("Suspended"), href: "/console/applications?status=Suspended" });
  if (["county_officer", "facilities_officer"].includes(user.role) || wide) queue.push({ label: "Facilities awaiting verification", n: d.facs.filter((f) => f.status === "Unverified").length, href: "/console/facilities" });
  if (canEvents) queue.push({ label: "Events awaiting approval", n: pendingEvents ?? 0, href: "/console/events" });
  if (user.role === "finance_officer" || showMoney) queue.push({ label: "Paid but not reconciled", n: state.applications.filter((a) => a.payment.status === "Paid" && !a.payment.reconciled).length, href: "/console/payments" });

  const recent = can("audit.view") ? state.audit.slice(0, 7) : [];

  return (
    <>
      <PageTitle
        title={`Good day, ${user.name.split(" ")[0]}`}
        sub={`${role.label} · ${role.office} · ${new Date(nowMs).toLocaleDateString("en-KE", { dateStyle: "full" })}`}
        action={<Link href="/console/applications" className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-forest-900"><ClipboardList size={16} /> Open applications</Link>}
      />

      {showApps && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {([
              ["registrations", "Registrations", d.apps.length.toLocaleString(), "new, last 30 days", "blue", <ClipboardList key="i" size={18} />, pct(d.last30, d.prev30)],
              ["verified", "Verified", d.count("Approved").toLocaleString(), `${d.verified}% of all`, "green", <BadgeCheck key="i" size={18} />, undefined],
              ["decision", "Awaiting decision", d.decision, "under review or endorsed", d.decision > 0 ? "amber" : "navy", <Scale key="i" size={18} />, undefined],
              ["appeals", "Appeals", d.appeals, "open with the Registrar", d.appeals > 0 ? "red" : "navy", <Landmark key="i" size={18} />, undefined],
              ...(showMoney ? [["fees", "Fees collected", `KSh ${d.revenue.toLocaleString()}`, `KSh ${d.outstanding.toLocaleString()} pending`, "green", <Wallet key="i" size={18} />, undefined]] : []),
              ["facilities", "Facilities", d.facs.length.toLocaleString(), `${d.facs.length ? Math.round((d.facs.filter((f) => f.status === "Verified").length / d.facs.length) * 100) : 0}% verified`, "navy", <MapPinned key="i" size={18} />, undefined],
            ] as [string, string, React.ReactNode, string, "blue" | "green" | "amber" | "red" | "navy", React.ReactNode, number | undefined][]).map(([key, label, value, hint, tone, icon, delta]) => (
              <KpiToggle key={key} label={label} value={value} hint={hint} tone={tone} icon={icon} delta={delta} active={openKpi === key} controls={`kpi-${key}`} onToggle={() => setOpenKpi(openKpi === key ? null : key)} />
            ))}
          </div>

          {openKpi && (
            <section id={`kpi-${openKpi}`} className="step-anim mt-3 rounded-2xl border border-line bg-white p-5 shadow-[0_22px_44px_-34px_rgba(6,45,87,0.6)] sm:p-6" aria-label={`${openKpi} details`}>
              {openKpi === "registrations" && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[["Total", d.apps.length], ["Last 30 days", d.last30], ["Previous 30", d.prev30]].map(([k, v]) => (
                      <div key={k as string} className="rounded-xl bg-bone px-2 py-4"><b className="block text-2xl tabular-nums text-forest-900">{v as number}</b><span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{k}</span></div>
                    ))}
                  </div>
                  <div><p className="mb-3 text-sm font-bold text-forest-900">Who is registering</p><BarList rows={d.type.slice(0, 5).map((r) => ({ ...r, color: "#2f6fc4" }))} /></div>
                </div>
              )}
              {openKpi === "verified" && (
                <div className="flex flex-wrap items-center gap-8">
                  <Ring value={d.verified} label="verified" />
                  <div className="min-w-[220px] flex-1">
                    <p className="mb-3 text-sm font-bold text-forest-900">Verified by type</p>
                    <BarList rows={Object.entries(d.apps.filter((a) => a.status === "Approved").reduce<Record<string, number>>((m, a) => ((m[a.type] = (m[a.type] ?? 0) + 1), m), {})).map(([label, value]) => ({ label, value, color: "#12743f" })).sort((a, b) => b.value - a.value).slice(0, 5)} />
                  </div>
                </div>
              )}
              {(openKpi === "decision" || openKpi === "appeals") && (() => {
                const list = (openKpi === "decision" ? d.apps.filter((a) => ["Under review", "Endorsed"].includes(a.status)) : d.apps.filter((a) => a.appeal && ["Rejected", "Suspended"].includes(a.status)))
                  .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6);
                return list.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-forest-800"><CheckCircle2 size={16} /> Nothing waiting here.</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm font-bold text-forest-900">{openKpi === "decision" ? "Oldest first: waiting for a decision" : "Appeals to answer"}</p>
                    <ul className="divide-y divide-line">
                      {list.map((a) => (
                        <li key={a.id}>
                          <Link href={`/console/applications?status=${encodeURIComponent(a.status)}`} className="group flex flex-wrap items-center justify-between gap-2 py-3">
                            <span className="min-w-0"><b className="block truncate text-sm text-forest-900">{a.clubName || a.name}</b><span className="text-xs text-ink-3">{a.type} · {SPORT_BY_ID[a.sport]?.name ?? a.sport} · {a.place.county}</span></span>
                            <span className="flex items-center gap-3 text-xs text-ink-3"><span className="rounded-full bg-bone px-2.5 py-1 font-semibold text-ink-2">{a.status}</span>{Math.max(0, Math.floor((nowMs - new Date(a.createdAt).getTime()) / DAY))} days<ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}
              {openKpi === "fees" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-3 text-sm font-bold text-forest-900">Collected and still pending</p>
                    <StackedBar parts={[{ label: "Collected", value: d.revenue, color: "#12743f" }, { label: "Pending", value: d.outstanding, color: "#d99a00" }]} />
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-bold text-forest-900">Fees by registration type</p>
                    <BarList rows={Object.entries(state.applications.filter((a) => a.payment.status === "Paid").reduce<Record<string, number>>((m, a) => ((m[a.type] = (m[a.type] ?? 0) + a.payment.amount), m), {})).map(([label, value]) => ({ label, value, color: "#12743f" })).sort((a, b) => b.value - a.value).slice(0, 5)} />
                    <Link href="/console/payments" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-forest-700 hover:underline">Open payments <ArrowRight size={14} /></Link>
                  </div>
                </div>
              )}
              {openKpi === "facilities" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div><p className="mb-3 text-sm font-bold text-forest-900">Verification status</p><StackedBar parts={d.facStatus} /></div>
                  <div>
                    <p className="mb-3 text-sm font-bold text-forest-900">Counties with most facilities</p>
                    <BarList rows={Object.entries(d.facs.reduce<Record<string, number>>((m, f) => ((m[f.place.county] = (m[f.place.county] ?? 0) + 1), m), {})).map(([label, value]) => ({ label, value, color: "#0b4f8a" })).sort((a, b) => b.value - a.value).slice(0, 5)} />
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {showApps && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card title="Registrations over the last 12 weeks">
            <TrendChart labels={d.labels} series={[{ name: "Submitted", color: "#2f6fc4", values: d.submitted }, { name: "Verified", color: "#12743f", values: d.approvedW }]} />
          </Card>
          <Card title="Where applications stand">
            <StackedBar parts={d.status} />
          </Card>
        </div>
      )}

      {showApps && (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card title="By registration type"><BarList rows={d.type.map((r) => ({ ...r, color: "#2f6fc4" }))} /></Card>
          <Card title="Top sports"><BarList rows={d.sport.map((r) => ({ ...r, color: "#2f6fc4" }))} /></Card>
          <Card title="Top counties"><BarList rows={d.county.map((r) => ({ ...r, color: "#2f6fc4" }))} /></Card>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Your work queue" className="lg:col-span-1">
          <ul className="divide-y divide-line">
            {queue.map((q) => (
              <li key={q.label}>
                <Link href={q.href} className="group flex items-center justify-between gap-4 py-3">
                  <span className="text-sm">{q.label}</span>
                  <span className="flex items-center gap-3">
                    <b className={`text-lg tabular-nums ${q.n > 0 ? "text-kenya-red" : "text-forest-700"}`}>{q.n}</b>
                    <ArrowRight size={15} className="text-ink-3 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
            {queue.length === 0 && <li className="py-3 text-sm text-ink-3">No tasks are assigned to this role.</li>}
            {queue.length > 0 && queue.every((q) => q.n === 0) && (
              <li className="flex items-center gap-2 py-3 text-sm text-forest-800"><CheckCircle2 size={16} /> Nothing waiting. You are all caught up.</li>
            )}
          </ul>
        </Card>

        <Card title="Facilities register">
          <StackedBar parts={d.facStatus} />
          <Link href="/console/facilities" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-forest-700 hover:underline">Open facilities <ArrowRight size={14} /></Link>
        </Card>

        {recent.length > 0 ? (
          <Card title="Recent activity" action={<Link href="/console/audit" className="text-xs font-bold text-forest-700 hover:underline">Audit log</Link>}>
            <ul className="space-y-3">
              {recent.map((e, i) => (
                <li key={i} className="text-sm">
                  <p className="font-semibold text-forest-900">{e.action}</p>
                  <p className="text-xs text-ink-3">{e.actor} · {e.target} · {new Date(e.at).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card title="What your role does">
            <p className="text-sm text-ink-2">{role.summary}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {role.duties.map((x) => (<li key={x} className="flex gap-2.5"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest-600" /> {x}</li>))}
            </ul>
            <p className="mt-4 rounded-lg bg-bone px-3 py-2 text-xs text-ink-3">Scope: {role.scope === "county" ? `${user.countyName} County only` : role.scope === "sport" ? `${SPORT_BY_ID[user.sportId ?? ""]?.name ?? ""} only` : "National"}</p>
          </Card>
        )}
      </div>
    </>
  );
}
