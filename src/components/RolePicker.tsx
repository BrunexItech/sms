"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { RoleItem } from "@/lib/types";
import { Field, inputCls } from "./ui/Field";

/** Roles from the Ministry's role catalogue that fit the chosen type, and the chosen sport for sport-specific ones. */
export function RolePicker({
  roles,
  type,
  sport,
  value,
  onChange,
  error,
  optional,
}: {
  roles: RoleItem[];
  type: string;
  sport: string;
  value: string;
  onChange: (id: string) => void;
  error?: string;
  optional?: boolean;
}) {
  const [q, setQ] = useState("");
  const usable = useMemo(() => roles.filter((r) => r.type === type && (!r.sports || r.sports.length === 0 || r.sports.includes(sport))), [roles, type, sport]);
  const shown = usable.filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...new Set(shown.map((r) => r.group))];
  const hiddenSpecific = roles.filter((r) => r.type === type && r.sports && r.sports.length && !r.sports.includes(sport)).length;

  return (
    <Field label={optional ? "Your role (optional)" : "Your role"} required={!optional} error={error} className="sm:col-span-2" hint={optional ? "Leave unselected if you simply play; you are then recorded as Athlete/Player." : hiddenSpecific && !sport ? "Choose a sport first to also see sport-specific roles." : undefined}>
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={`${inputCls} py-2.5 pl-9`} placeholder="Search roles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search roles" />
      </div>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} size={Math.min(8, Math.max(3, shown.length + groups.length))}>
        {optional && <option value="">Athlete / Player (default)</option>}
        {shown.length === 0 && <option value="" disabled>No role matches</option>}
        {groups.map((g) => (
          <optgroup key={g} label={g.replace(/ roles$/, " (sport-specific)")}>
            {shown.filter((r) => r.group === g).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}
