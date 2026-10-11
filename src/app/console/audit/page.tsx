"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { inputCls } from "@/components/ui/Field";
import { NoAccess, PageTitle, downloadCsv } from "@/components/console/ui";

export default function Page() {
  const { state, can } = useStore();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return state.audit.filter((a) => !n || `${a.actor} ${a.role} ${a.action} ${a.target}`.toLowerCase().includes(n));
  }, [state.audit, q]);
  if (!can("audit.view")) return <NoAccess need="audit.view" />;

  return (
    <>
      <PageTitle
        title="Audit log"
        sub="Every consequential action is recorded with who, what and when. Entries cannot be edited."
        action={
          can("reports.export") && (
            <button onClick={() => downloadCsv("audit.csv", [["When", "Actor", "Role", "Action", "Target"], ...rows.map((a) => [a.at, a.actor, a.role, a.action, a.target])])} className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold hover:bg-bone">
              Export CSV
            </button>
          )
        }
      />
      <input className={`${inputCls} mb-4 max-w-md`} placeholder="Filter by person, action or record…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bone/60 text-xs uppercase tracking-wider text-ink-3">
              {["When", "Actor", "Role", "Action", "Record"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((a, i) => (
              <tr key={i} className="border-b border-line/70">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-3">{new Date(a.at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-3 font-semibold">{a.actor}</td>
                <td className="px-4 py-3 text-ink-2">{a.role}</td>
                <td className="px-4 py-3">{a.action}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-2">{a.target}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-14 text-center text-ink-3">No activity recorded yet. Approve, reject or pay something and it will appear here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
