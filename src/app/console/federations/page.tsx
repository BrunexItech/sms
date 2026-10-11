"use client";

import { useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Federation } from "@/lib/types";
import { inputCls } from "@/components/ui/Field";
import { NoAccess, PageTitle } from "@/components/console/ui";

function Row({ f }: { f: Federation }) {
  const { saveFederation } = useStore();
  const [name, setName] = useState(f.name);
  const [status, setStatus] = useState<string>(f.status);
  const [email, setEmail] = useState(f.contactEmail);
  const dirty = name !== f.name || status !== f.status || email !== f.contactEmail;
  return (
    <tr className="border-b border-line/70 align-top">
      <td className="px-4 py-3 font-semibold">{f.sportName}</td>
      <td className="px-4 py-3"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-label={`Federation for ${f.sportName}`} /></td>
      <td className="px-4 py-3">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option>Recognised</option>
          <option>To be confirmed</option>
        </select>
      </td>
      <td className="px-4 py-3"><input className={inputCls} type="email" placeholder="contact@federation.ke" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Contact email" /></td>
      <td className="px-4 py-3 text-right">
        <button disabled={!dirty} onClick={() => saveFederation(f.sportId, { name, status, contactEmail: email })} className="inline-flex items-center gap-1.5 rounded-lg bg-forest-800 px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-30">
          <Save size={14} /> Save
        </button>
      </td>
    </tr>
  );
}

export default function Page() {
  const { state, can } = useStore();
  const [q, setQ] = useState("");
  const rows = useMemo(() => state.federations.filter((f) => !q.trim() || `${f.sportName} ${f.name}`.toLowerCase().includes(q.trim().toLowerCase())), [state.federations, q]);
  if (!can("federations.manage")) return <NoAccess need="federations.manage" />;
  const open = state.federations.filter((f) => f.status !== "Recognised").length;
  return (
    <>
      <PageTitle title="Federations" sub={`${state.federations.length} sports, each tied to its governing body. ${open} still to be confirmed by the Registrar.`} />
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={`${inputCls} pl-10`} placeholder="Search sport or federation…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-bone/60 text-xs uppercase tracking-wider text-ink-3">
              {["Sport", "Governing body", "Status", "Contact", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>{rows.map((f) => <Row key={`${f.sportId}-${f.name}-${f.status}-${f.contactEmail}`} f={f} />)}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-3">Names come from the Ministry brief. Confirm each against the Registrar&apos;s records; new registrations pick up the federation shown here.</p>
    </>
  );
}
