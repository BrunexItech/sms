"use client";

import { useMemo, useState } from "react";
import { Banknote, Download, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Pill } from "@/components/ui/Pill";
import { inputCls } from "@/components/ui/Field";
import { Card, NoAccess, PageTitle, Stat, downloadCsv } from "@/components/console/ui";

export default function Page() {
  const { state, can, manualPay, toggleReconciled, refund } = useStore();
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [manual, setManual] = useState<{ id: string; method: string; ref: string } | null>(null);

  const rows = useMemo(
    () =>
      state.applications.filter((a) => {
        const n = q.trim().toLowerCase();
        if (n && !`${a.id} ${a.name} ${a.clubName} ${a.payment.receipt ?? ""} ${a.payment.ref ?? ""}`.toLowerCase().includes(n)) return false;
        if (filter === "unreconciled") return a.payment.status === "Paid" && !a.payment.reconciled;
        if (filter) return a.payment.status === filter;
        return true;
      }),
    [state.applications, filter, q],
  );
  if (!can("payments.view")) return <NoAccess need="payments.view" />;
  const rec = can("payments.reconcile");

  const paid = state.applications.filter((a) => a.payment.status === "Paid");
  const total = paid.reduce((n, a) => n + a.payment.amount, 0);
  const unrec = paid.filter((a) => !a.payment.reconciled);

  return (
    <>
      <PageTitle
        title="Payments"
        sub="Fees collected, reconciliation and refunds."
        action={
          can("reports.export") && (
            <button
              onClick={() => downloadCsv("payments.csv", [["Reference", "Payer", "Type", "Amount", "Status", "Method", "Reference no.", "Receipt", "Reconciled"], ...rows.map((a) => [a.id, a.clubName || a.name, a.type, a.payment.amount, a.payment.status, a.payment.method ?? "", a.payment.ref ?? "", a.payment.receipt ?? "", a.payment.reconciled ? "Yes" : "No"])])}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold hover:bg-bone"
            >
              <Download size={15} /> Export CSV
            </button>
          )
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Collected" value={`KSh ${total.toLocaleString()}`} tone="good" hint={`${paid.length} payments`} />
        <Stat label="Unreconciled" value={unrec.length} tone={unrec.length ? "alert" : "default"} hint={`KSh ${unrec.reduce((n, a) => n + a.payment.amount, 0).toLocaleString()}`} />
        <Stat label="Awaiting payment" value={state.applications.filter((a) => a.payment.status === "Pending").length} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px]">
        <input className={inputCls} placeholder="Search payer, reference or receipt…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
          <option value="">All payments</option>
          <option>Paid</option>
          <option>Pending</option>
          <option>Refunded</option>
          <option value="unreconciled">Paid, not reconciled</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bone/60 text-xs uppercase tracking-wider text-ink-3">
              {["Reference", "Payer", "Amount", "Method", "Receipt", "Status", "Reconciled", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-line/70">
                <td className="px-4 py-3.5 font-mono text-xs">{a.id}</td>
                <td className="px-4 py-3.5 font-semibold">{a.clubName || a.name}</td>
                <td className="px-4 py-3.5">KSh {a.payment.amount.toLocaleString()}</td>
                <td className="px-4 py-3.5 text-ink-2">{a.payment.method ?? "—"}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-ink-2">{a.payment.receipt ?? "—"}</td>
                <td className="px-4 py-3.5"><Pill>{a.payment.status}</Pill></td>
                <td className="px-4 py-3.5">
                  {a.payment.status === "Paid" ? (
                    <input type="checkbox" checked={!!a.payment.reconciled} disabled={!rec} onChange={() => toggleReconciled(a.id)} aria-label="Reconciled" className="h-4 w-4 accent-forest-700" />
                  ) : "—"}
                </td>
                <td className="px-4 py-3.5 text-right">
                  {rec && a.payment.status === "Pending" && (
                    <button onClick={() => setManual({ id: a.id, method: "Bank transfer", ref: "" })} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-bone"><Banknote size={13} /> Record payment</button>
                  )}
                  {rec && a.payment.status === "Paid" && (
                    <button onClick={() => { if (confirm(`Refund KSh ${a.payment.amount} to ${a.clubName || a.name}?`)) refund(a.id); }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-red-50"><Undo2 size={13} /> Refund</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-14 text-center text-ink-3">No payments match.</td></tr>}
          </tbody>
        </table>
      </div>

      {manual && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-forest-950/50 p-5">
          <Card title="Record a manual payment" className="w-full max-w-md shadow-2xl">
            <p className="mb-4 text-sm text-ink-2">For cash, bank or cheque payments received outside the online gateway. <span className="font-mono">{manual.id}</span></p>
            <div className="space-y-3">
              <select className={inputCls} value={manual.method} onChange={(e) => setManual({ ...manual, method: e.target.value })}>
                <option>Bank transfer</option><option>Cash</option><option>Cheque</option>
              </select>
              <input className={inputCls} placeholder="Bank slip / cheque / receipt reference" value={manual.ref} onChange={(e) => setManual({ ...manual, ref: e.target.value })} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setManual(null)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-bone">Cancel</button>
              <button disabled={!manual.ref.trim()} onClick={() => { manualPay(manual.id, manual.method, manual.ref.trim()); setManual(null); }} className="rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50">Save</button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
