"use client";

import { Plus, X } from "lucide-react";
import { REQUIRED_OFFICIALS, type ClubOfficial, type RoleItem } from "@/lib/types";
import { Field, inputCls } from "./ui/Field";

const GROUP = "Club leadership and administration";
/** Always shown, in this order: the three required office-bearers, then the CEO. */
export const DEFAULT_OFFICIALS: ClubOfficial[] = [...REQUIRED_OFFICIALS, "chief-executive-officer-ceo"].map((role) => ({ role, name: "", phone: "", email: "" }));

export function OfficialsEditor({
  roles,
  value,
  onChange,
  errors,
}: {
  roles: RoleItem[];
  value: ClubOfficial[];
  onChange: (v: ClubOfficial[]) => void;
  errors: Partial<Record<string, string>>;
}) {
  const leadership = roles.filter((r) => r.group === GROUP);
  const nameOf = (id: string) => leadership.find((r) => r.id === id)?.name ?? id;
  const set = (i: number, patch: Partial<ClubOfficial>) => onChange(value.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const locked = (role: string) => REQUIRED_OFFICIALS.includes(role) || role === "chief-executive-officer-ceo";

  return (
    <fieldset className="rounded-xl border border-line bg-bone p-4 sm:col-span-2">
      <legend className="px-2 text-[13px] font-semibold">Club officials</legend>
      <p className="mb-3 text-xs text-ink-3">Chairperson, Secretary and Treasurer are required. Add anyone else who holds office.</p>
      <div className="space-y-3">
        {value.map((o, i) => {
          const required = REQUIRED_OFFICIALS.includes(o.role);
          return (
            <div key={i} className="grid gap-2.5 rounded-lg bg-white p-3 ring-1 ring-line sm:grid-cols-[1.1fr_1.2fr_1fr_1fr_auto] sm:items-end">
              <Field label="Role" required={required}>
                {locked(o.role) ? (
                  <input className={inputCls} readOnly value={nameOf(o.role)} />
                ) : (
                  <select className={inputCls} value={o.role} onChange={(e) => set(i, { role: e.target.value })}>
                    {leadership.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Full name" required={required} error={errors[`official-${o.role}`]}>
                <input className={inputCls} value={o.name} onChange={(e) => set(i, { name: e.target.value })} />
              </Field>
              <Field label="Phone"><input className={inputCls} inputMode="tel" value={o.phone} onChange={(e) => set(i, { phone: e.target.value })} /></Field>
              <Field label="Email"><input className={inputCls} type="email" value={o.email} onChange={(e) => set(i, { email: e.target.value })} /></Field>
              {locked(o.role) ? <span className="hidden sm:block sm:w-9" /> : (
                <button type="button" aria-label={`Remove ${nameOf(o.role)}`} onClick={() => onChange(value.filter((_, k) => k !== i))} className="grid h-11 w-9 place-items-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-kenya-red"><X size={16} /></button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange([...value, { role: "vice-chairperson-vice-president", name: "", phone: "", email: "" }])}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm font-bold text-forest-800 hover:bg-forest-100"
      >
        <Plus size={15} /> Add another official
      </button>
    </fieldset>
  );
}
