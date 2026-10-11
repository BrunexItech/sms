"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BadgeCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { api } from "@/lib/api";
import { SPORT_BY_ID } from "@/data/sports";
import { Field, inputCls } from "./ui/Field";
import { BlockLoader } from "./ui/Spinner";

interface Result {
  found: boolean;
  valid?: boolean;
  status?: string;
  holder?: string;
  type?: string;
  sport?: string;
  county?: string;
  certificateNo?: string;
}

export function VerifyView() {
  const qs = useSearchParams();
  const initial = qs.get("no") ?? "";
  const [no, setNo] = useState(initial);
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<{ q: string; data: Result } | null>(null);

  useEffect(() => {
    if (!q.trim()) return;
    let cancelled = false;
    const key = q.trim();
    api<Result>(`/verify/${encodeURIComponent(key)}`)
      .then((r) => !cancelled && setRes({ q: key, data: r }))
      .catch(() => !cancelled && setRes({ q: key, data: { found: false } }));
    return () => {
      cancelled = true;
    };
  }, [q]);

  const loading = !!q.trim() && res?.q !== q.trim();
  const view = res?.q === q.trim() ? res.data : null;
  return (
    <div className="mx-auto max-w-2xl px-5 pb-24">
      <div className="-mt-8 rounded-2xl border border-line bg-white p-6 shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)] sm:p-8">
        <form onSubmit={(e) => { e.preventDefault(); setQ(no); }} className="flex flex-wrap items-end gap-3">
          <Field label="Certificate number" className="min-w-[220px] flex-1">
            <input className={inputCls} placeholder="KE-NSR-2026-00000" value={no} onChange={(e) => setNo(e.target.value)} />
          </Field>
          <button className="mb-[1px] rounded-xl bg-forest-800 px-6 py-3 text-sm font-bold text-white hover:bg-forest-900">Verify</button>
        </form>
        {loading && <BlockLoader label="Checking the register" />}
        {!loading && q && view?.found && (
          <div className={`step-anim mt-6 rounded-xl p-5 ${view.valid ? "bg-leaf-soft" : "bg-red-50"}`}>
            <div className="flex items-center gap-3">
              {view.valid ? <BadgeCheck className="text-leaf" size={30} /> : <ShieldAlert className="text-kenya-red" size={30} />}
              <div>
                <p className="text-xl font-extrabold">{view.valid ? "Valid registration" : `Registration ${view.status?.toLowerCase()}`}</p>
                <p className="font-mono text-xs text-ink-3">{view.certificateNo}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wider text-ink-3">Holder</dt><dd className="font-semibold">{view.holder}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-ink-3">Category</dt><dd>{view.type}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-ink-3">Sport</dt><dd>{SPORT_BY_ID[view.sport ?? ""]?.name}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-ink-3">County</dt><dd>{view.county}</dd></div>
            </dl>
          </div>
        )}
        {!loading && q && view && !view.found && (
          <div className="step-anim mt-6 flex items-center gap-3 rounded-xl bg-bone p-5">
            <ShieldQuestion size={30} className="text-ink-3" />
            <div>
              <p className="text-xl font-extrabold">Not found</p>
              <p className="text-sm text-ink-2">No active certificate has that number. Check it and try again.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
