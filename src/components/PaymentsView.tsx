"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { STAKEHOLDER_TYPES } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Pill } from "./ui/Pill";

export function PaymentsView() {
  const { state, member, user } = useStore();
  const mine = member ? state.applications.filter((a) => !a.clubId) : [];

  return (
    <div className="mx-auto grid max-w-[1100px] gap-6 px-5 pb-24 lg:grid-cols-[1fr_1.1fr]">
      <section className="-mt-8 rounded-2xl border border-line bg-white p-6 shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)] sm:p-7">
        <p className="eyebrow text-kenya-red">Fee schedule</p>
        <h2 className="mt-2 text-2xl font-extrabold text-forest-900">Registration fees</h2>
        <ul className="mt-5 divide-y divide-line">
          {STAKEHOLDER_TYPES.map((t) => (
            <li key={t} className="flex items-center justify-between py-3 text-[15px]">
              <span>{t}</span>
              <b className="text-lg font-extrabold">KSh {(state.fees[t] ?? 0).toLocaleString()}</b>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-ink-3">Fees are set by the Ministry. Every change is recorded in the audit log.</p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 sm:p-7 lg:-mt-8">
        <p className="eyebrow text-kenya-red">Your payments</p>
        <h2 className="mt-2 text-2xl font-extrabold text-forest-900">Pay or check a registration</h2>
        {!member && (
          <div className="mt-5 rounded-xl bg-bone p-5 text-sm text-ink-2">
            {user ? "Staff accounts manage payments from the console." : "Sign in to pay for a registration or see your receipts."}
            <div className="mt-3">
              <Link href={user ? "/console/payments" : "/login"} className="rounded-lg bg-forest-800 px-5 py-2.5 text-sm font-bold text-white">
                {user ? "Open payments console" : "Sign in"}
              </Link>
            </div>
          </div>
        )}
        {member && mine.length === 0 && <p className="mt-5 text-sm text-ink-3">You have no registrations yet. <Link href="/register" className="font-bold text-forest-700 underline">Register</Link>.</p>}
        {member && (
          <ul className="mt-5 space-y-3">
            {mine.map((a) => (
              <li key={a.id} className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{a.clubName || a.name}</p>
                    <p className="font-mono text-[11px] text-ink-3">{a.id} · {a.type}</p>
                  </div>
                  <Pill>{a.payment.status}</Pill>
                </div>
                <p className="mt-2 text-xl font-extrabold">KSh {a.payment.amount.toLocaleString()}</p>
                {a.payment.status === "Paid" ? (
                  <p className="mt-1 flex items-center gap-2 text-sm text-leaf"><CheckCircle2 size={15} /> {a.payment.method} · Receipt <span className="font-mono">{a.payment.receipt}</span></p>
                ) : (
                  <Link href="/account" className="mt-2 inline-block rounded-lg bg-leaf px-4 py-2 text-sm font-bold text-white">Pay from My account</Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {member && state.club && <p className="mt-4 text-sm text-ink-2">Paying for your players? Use the roster in <Link href="/account" className="font-bold text-forest-700 underline">My account</Link>.</p>}
      </section>
    </div>
  );
}
