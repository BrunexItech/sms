"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SPORT_BY_ID } from "@/data/sports";
import { ROLE_BY_ID, inScopeApp, inScopeFacility } from "@/lib/roles";
import { useStore } from "@/lib/store";
import { BarList, Card, PageTitle, Stat } from "@/components/console/ui";
import { NotificationList } from "@/components/NotificationList";

const STATUS_COLORS: Record<string, string> = {
  Submitted: "#2563eb",
  "Under review": "#d97706",
  "Needs info": "#ea580c",
  Endorsed: "#0d9488",
  Approved: "#12743f",
  Rejected: "#c8102e",
  Suspended: "#7f1d1d",
};

export default function ConsoleHome() {
  const { state, user, can } = useStore();

  const data = useMemo(() => {
    if (!user) return null;
    const apps = can("applications.view") ? state.applications.filter((a) => inScopeApp(user, a)) : [];
    const facs = state.facilities.filter((f) => inScopeFacility(user, f));
    const byStatus = Object.entries(
      apps.reduce<Record<string, number>>((m, a) => ((m[a.status] = (m[a.status] ?? 0) + 1), m), {}),
    ).map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] }));
    const bySport = Object.entries(
      apps.reduce<Record<string, number>>((m, a) => ((m[a.sport] = (m[a.sport] ?? 0) + 1), m), {}),
    )
      .map(([k, value]) => ({ label: SPORT_BY_ID[k]?.name ?? k, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const byCounty = Object.entries(
      apps.reduce<Record<string, number>>((m, a) => ((m[a.place.county] = (m[a.place.county] ?? 0) + 1), m), {}),
    )
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return { apps, facs, byStatus, bySport, byCounty };
  }, [state, user, can]);

  if (!user || !data) return null;
  const role = ROLE_BY_ID[user.role];
  const { apps, facs } = data;
  const count = (s: string) => apps.filter((a) => a.status === s).length;
  const revenue = state.applications.filter((a) => a.payment.status === "Paid").reduce((n, a) => n + a.payment.amount, 0);

  // Work queue: what this role must act on next.
  const queue: { label: string; n: number; href: string }[] = [];
  if (user.role === "county_officer") {
    queue.push({ label: "New applications to review", n: count("Submitted"), href: "/console/applications?status=Submitted" });
    queue.push({ label: "Waiting on applicant information", n: count("Needs info"), href: "/console/applications?status=Needs%20info" });
    queue.push({ label: "Unverified facilities in your county", n: facs.filter((f) => f.status === "Unverified").length, href: "/console/facilities" });
  }
  if (user.role === "federation_admin") queue.push({ label: "Members awaiting your endorsement", n: count("Under review"), href: "/console/applications?status=Under%20review" });
  if (user.role === "registrar") {
    queue.push({ label: "Ready for your decision", n: count("Under review") + count("Endorsed"), href: "/console/applications?status=Endorsed" });
    queue.push({ label: "New, not yet reviewed", n: count("Submitted"), href: "/console/applications?status=Submitted" });
  }
  if (user.role === "integrity_officer") {
    queue.push({ label: "Currently suspended", n: count("Suspended"), href: "/console/applications?status=Suspended" });
    queue.push({ label: "Approved records you can act on", n: count("Approved"), href: "/console/applications?status=Approved" });
  }
  if (user.role === "facilities_officer") {
    queue.push({ label: "Facilities awaiting verification", n: facs.filter((f) => f.status === "Unverified").length, href: "/console/facilities" });
    queue.push({ label: "Verified, never inspected", n: facs.filter((f) => f.status === "Verified" && f.inspections.length === 0).length, href: "/console/facilities" });
  }
  if (user.role === "finance_officer") {
    queue.push({ label: "Paid but not reconciled", n: state.applications.filter((a) => a.payment.status === "Paid" && !a.payment.reconciled).length, href: "/console/payments" });
    queue.push({ label: "Registrations still unpaid", n: state.applications.filter((a) => a.payment.status === "Pending").length, href: "/console/payments" });
  }
  if (user.role === "system_admin") {
    queue.push({ label: "Active staff accounts", n: state.staff.filter((u) => u.active).length, href: "/console/staff" });
    queue.push({ label: "Audit entries recorded", n: state.audit.length, href: "/console/audit" });
  }

  return (
    <>
      <PageTitle title={`Good day, ${user.name.split(" ")[0]}`} sub={`${role.label} · ${role.office}`} />

      <div className="mb-5"><NotificationList /></div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card title="Your work queue">
          <ul className="divide-y divide-line">
            {queue.map((q) => (
              <li key={q.label}>
                <Link href={q.href} className="group flex items-center justify-between gap-4 py-4">
                  <span className="text-[15px]">{q.label}</span>
                  <span className="flex items-center gap-3">
                    <b className={`font-display text-3xl ${q.n > 0 ? "text-kenya-red" : "text-forest-700"}`}>{q.n}</b>
                    <ArrowRight size={16} className="text-ink-3 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
            {queue.every((q) => q.n === 0) && (
              <li className="flex items-center gap-2 py-4 text-sm text-forest-800"><CheckCircle2 size={16} /> Nothing waiting. You&apos;re all caught up.</li>
            )}
          </ul>
        </Card>

        <Card title="What your role does">
          <p className="text-sm text-ink-2">{role.summary}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {role.duties.map((d) => (
              <li key={d} className="flex gap-2.5"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-forest-600" /> {d}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-bone px-3 py-2 text-xs text-ink-3">
            Scope: {role.scope === "county" ? `${user.countyName} County only` : role.scope === "sport" ? `${SPORT_BY_ID[user.sportId ?? ""]?.name ?? ""} only` : "National"}
          </p>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {can("applications.view") && <Stat label="Applications in scope" value={apps.length} hint={`${count("Approved")} approved`} />}
        {can("applications.view") && <Stat label="Pending decision" value={count("Under review") + count("Endorsed")} tone={count("Under review") + count("Endorsed") > 0 ? "alert" : "default"} />}
        {(can("facilities.verify") || user.role === "county_officer") && <Stat label="Facilities in scope" value={facs.length} hint={`${facs.filter((f) => f.status === "Verified").length} verified`} />}
        {can("payments.view") && <Stat label="Fees collected" value={`KSh ${revenue.toLocaleString()}`} tone="good" />}
        {can("users.manage") && <Stat label="Staff accounts" value={state.staff.length} />}
      </div>

      {apps.length > 0 && (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card title="By status"><BarList rows={data.byStatus} /></Card>
          <Card title="By sport"><BarList rows={data.bySport} /></Card>
          <Card title="By county"><BarList rows={data.byCounty} /></Card>
        </div>
      )}
    </>
  );
}
