"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, KeyRound, Plus, RotateCcw, Save, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { SPORTS } from "@/data/sports";
import { PERMISSION_LABELS, ROLES, ROLE_BY_ID, type Permission, type RoleId, type StaffUser } from "@/lib/roles";
import { errText, useStore } from "@/lib/store";
import { Field, inputCls } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { BlockLoader, ButtonSpinner } from "@/components/ui/Spinner";
import { Card, Drawer, NoAccess, PageTitle } from "@/components/console/ui";

interface Overview {
  catalog: Permission[];
  roles: { id: RoleId; perms: Permission[]; defaults: Permission[]; locked: boolean }[];
  coverage: {
    counties: { id: string; name: string; officers: number; pending: number }[];
    sports: { id: string; name: string; admins: number; pending: number }[];
  };
  applicants: number;
}
interface MemberRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt: string;
  registrations: number;
}
type Tab = "roles" | "people" | "coverage" | "applicants";

const TABS: { id: Tab; label: string }[] = [
  { id: "people", label: "People & access" },
  { id: "roles", label: "Role rights" },
  { id: "coverage", label: "Verification coverage" },
  { id: "applicants", label: "Applicant accounts" },
];

export default function Page() {
  const { can, me, state, updateStaff, addStaff, notify, admin } = useStore();
  const [tab, setTab] = useState<Tab>("people");
  const [ov, setOv] = useState<Overview | null>(null);
  const [edit, setEdit] = useState<StaffUser | null>(null);
  const [adding, setAdding] = useState<Partial<{ role: RoleId; countyId: string; sportId: string }> | null>(null);

  const load = useCallback(async () => {
    try {
      setOv(await api<Overview>("/control/overview"));
    } catch (e) {
      notify(errText(e), "error");
    }
  }, [notify]);
  useEffect(() => {
    let cancelled = false;
    api<Overview>("/control/overview")
      .then((r) => !cancelled && setOv(r))
      .catch((e) => !cancelled && notify(errText(e), "error"));
    return () => {
      cancelled = true;
    };
  }, [notify]);

  if (!can("users.manage") && !can("roles.manage")) return <NoAccess need="users.manage" />;
  const isSuper = me?.role === "super_admin";
  const canRights = can("roles.manage");

  return (
    <>
      <PageTitle
        title="Control Center"
        sub="Who can sign in, what each role may do, and who is responsible for verifying each county and sport."
      />
      {!isSuper && (
        <p className="mb-4 flex gap-2.5 rounded-xl border-l-4 border-gold bg-gold-soft p-3.5 text-[13px] text-ink-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          You can manage accounts. Changing role rights and assigning a Super Administrator is reserved for the Super Administrator.
        </p>
      )}

      <div role="tablist" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${tab === t.id ? "bg-forest-800 text-white" : "bg-white text-ink-2 ring-1 ring-line hover:bg-forest-100"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {!ov ? (
        <BlockLoader label="Loading the control centre" />
      ) : (
        <>
          {tab === "people" && <People staff={state.staff} edit={setEdit} adding={adding} setAdding={setAdding} canRights={canRights} isSuper={isSuper} addStaff={addStaff} admin={admin} />}
          {tab === "roles" && <Roles ov={ov} canRights={canRights} reload={load} />}
          {tab === "coverage" && (
            <Coverage ov={ov} assign={(a) => { setAdding(a); setTab("people"); }} />
          )}
          {tab === "applicants" && <Applicants updateStaff={updateStaff} />}
        </>
      )}

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ""} subtitle={edit ? `${ROLE_BY_ID[edit.role as RoleId]?.label} · ${edit.email}` : ""}>
        {edit && ov && (
          <EditUser
            key={edit.id}
            u={edit}
            ov={ov}
            self={edit.id === me?.id}
            canRights={canRights}
            isSuper={isSuper}
            onDone={() => { setEdit(null); load(); }}
          />
        )}
      </Drawer>
    </>
  );
}

/* ───────── people ───────── */
function People({ staff, edit, adding, setAdding, canRights, isSuper, addStaff, admin }: {
  staff: StaffUser[];
  edit: (u: StaffUser) => void;
  adding: Partial<{ role: RoleId; countyId: string; sportId: string }> | null;
  setAdding: (v: Partial<{ role: RoleId; countyId: string; sportId: string }> | null) => void;
  canRights: boolean;
  isSuper: boolean;
  addStaff: ReturnType<typeof useStore>["addStaff"];
  admin: ReturnType<typeof useStore>["admin"];
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => staff.filter((u) => !q.trim() || `${u.name} ${u.email} ${ROLE_BY_ID[u.role as RoleId]?.label} ${u.countyName ?? ""} ${u.sportId ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [staff, q]);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card title={`Staff accounts (${staff.length})`}>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className={`${inputCls} pl-10`} placeholder="Search staff by name, email, role, county or sport…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="divide-y divide-line">
          {rows.map((u) => {
            const r = ROLE_BY_ID[u.role as RoleId];
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className={`font-semibold ${u.active ? "" : "text-ink-3 line-through"}`}>{u.name}</p>
                  <p className="text-xs text-ink-3">
                    {r?.label}
                    {u.countyName ? ` · ${u.countyName}` : ""}
                    {u.sportId ? ` · ${SPORTS.find((s) => s.id === u.sportId)?.name}` : ""} · {u.email}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {u.lastLogin ? `Last sign-in ${new Date(u.lastLogin).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}` : "Never signed in"}
                    {(u.extraPerms?.length || u.deniedPerms?.length) ? ` · custom rights (+${u.extraPerms?.length ?? 0} / −${u.deniedPerms?.length ?? 0})` : ""}
                  </p>
                </div>
                <button onClick={() => edit(u)} className="rounded-lg border border-line px-3.5 py-2 text-sm font-bold text-forest-800 hover:bg-bone">Manage</button>
              </li>
            );
          })}
          {rows.length === 0 && <li className="py-8 text-center text-sm text-ink-3">No staff match.</li>}
        </ul>
      </Card>

      <Card title="Add a staff account" action={adding ? <button onClick={() => setAdding(null)} className="text-xs font-bold text-ink-3">Close</button> : null}>
        <AddForm key={JSON.stringify(adding)} preset={adding ?? {}} isSuper={isSuper} canRights={canRights} addStaff={addStaff} admin={admin} />
      </Card>
    </div>
  );
}

function AddForm({ preset, isSuper, addStaff, admin }: {
  preset: Partial<{ role: RoleId; countyId: string; sportId: string }>;
  isSuper: boolean;
  canRights: boolean;
  addStaff: ReturnType<typeof useStore>["addStaff"];
  admin: ReturnType<typeof useStore>["admin"];
}) {
  const [f, setF] = useState({ name: "", email: "", role: (preset.role ?? "county_officer") as RoleId, title: "", password: "", countyId: preset.countyId ?? "", sportId: preset.sportId ?? "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const role = ROLE_BY_ID[f.role];
  const submit = async () => {
    if (f.name.trim().length < 3) return setErr("Enter the staff member's name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr("Enter a valid email.");
    if (f.password.length < 8) return setErr("Set an initial password of at least 8 characters.");
    if (role.scope === "county" && !f.countyId) return setErr("Assign a county.");
    if (role.scope === "sport" && !f.sportId) return setErr("Assign a sport.");
    setBusy(true);
    const ok = await addStaff({ name: f.name.trim(), email: f.email.trim(), role: f.role, title: f.title.trim() || role.label, password: f.password,
      countyId: role.scope === "county" ? f.countyId : undefined, sportId: role.scope === "sport" ? f.sportId : undefined });
    setBusy(false);
    if (ok) setF({ ...f, name: "", email: "", title: "", password: "" });
    setErr("");
  };
  return (
    <div className="space-y-4">
      <Field label="Full name" required><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Official email" required><input className={inputCls} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Role" required>
        <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as RoleId })}>
          {ROLES.filter((r) => isSuper || r.id !== "super_admin").map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </Field>
      {role.scope === "county" && (
        <Field label="County" required>
          <select className={inputCls} value={f.countyId} onChange={(e) => setF({ ...f, countyId: e.target.value })}>
            <option value="">Select county</option>
            {admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
          </select>
        </Field>
      )}
      {role.scope === "sport" && (
        <Field label="Sport / federation" required>
          <select className={inputCls} value={f.sportId} onChange={(e) => setF({ ...f, sportId: e.target.value })}>
            <option value="">Select sport</option>
            {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Initial password" required hint="At least 8 characters. Share it securely."><input className={inputCls} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      <Field label="Job title"><input className={inputCls} placeholder={role.label} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      {err && <p role="alert" className="text-xs font-semibold text-kenya-red">{err}</p>}
      <button onClick={submit} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest-800 py-3 text-sm font-bold text-white disabled:opacity-80">
        {busy ? <ButtonSpinner /> : <Plus size={16} />} Create account
      </button>
    </div>
  );
}

function EditUser({ u, ov, self, canRights, isSuper, onDone }: { u: StaffUser; ov: Overview; self: boolean; canRights: boolean; isSuper: boolean; onDone: () => void }) {
  const { updateStaff, admin } = useStore();
  const [role, setRole] = useState<RoleId>(u.role as RoleId);
  const [extra, setExtra] = useState<Permission[]>(u.extraPerms ?? []);
  const [denied, setDenied] = useState<Permission[]>(u.deniedPerms ?? []);
  const [countyId, setCountyId] = useState(u.countyId ?? "");
  const [sportId, setSportId] = useState(u.sportId ?? "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const roleRights = ov.roles.find((r) => r.id === role)?.perms ?? [];
  const scope = ROLE_BY_ID[role]?.scope;
  const locked = u.role === "super_admin" && !isSuper;
  const toggle = (list: Permission[], set: (v: Permission[]) => void, p: Permission) => set(list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);

  const save = async (patch: Parameters<typeof updateStaff>[1]) => {
    setBusy(true);
    const ok = await updateStaff(u.id, patch);
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <div className="space-y-6">
      {locked && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-kenya-red-deep">Only a Super Administrator can change this account.</p>}
      <fieldset disabled={locked || busy} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <select className={inputCls} value={role} disabled={self || !canRights} onChange={(e) => setRole(e.target.value as RoleId)}>
              {ROLES.filter((r) => isSuper || r.id !== "super_admin").map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          {scope === "county" && (
            <Field label="County">
              <select className={inputCls} value={countyId} onChange={(e) => setCountyId(e.target.value)}>
                <option value="">Select county</option>
                {admin.counties.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}
              </select>
            </Field>
          )}
          {scope === "sport" && (
            <Field label="Sport / federation">
              <select className={inputCls} value={sportId} onChange={(e) => setSportId(e.target.value)}>
                <option value="">Select sport</option>
                {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        {canRights && !self && role !== "super_admin" && (
          <>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Rights from the role ({ROLE_BY_ID[role]?.label})</p>
              <p className="mb-2 text-xs text-ink-3">Untick to withhold a right from this person only.</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {roleRights.map((p) => (
                  <li key={p}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-bone">
                      <input type="checkbox" className="h-4 w-4 accent-forest-700" checked={!denied.includes(p)} onChange={() => toggle(denied, setDenied, p)} />
                      {PERMISSION_LABELS[p]}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Extra rights for this person</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {ov.catalog.filter((p) => !roleRights.includes(p)).map((p) => (
                  <li key={p}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-bone">
                      <input type="checkbox" className="h-4 w-4 accent-forest-700" checked={extra.includes(p)} onChange={() => toggle(extra, setExtra, p)} />
                      {PERMISSION_LABELS[p]}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">County and sport limits still apply: an officer only ever acts inside their own scope.</p>
            </div>
          </>
        )}

        <Field label="Reset password" hint="Leave blank to keep the current password.">
          <input className={inputCls} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>

        <button
          onClick={() => save({
            ...(canRights && !self ? { role, extraPerms: role === "super_admin" ? [] : extra, deniedPerms: role === "super_admin" ? [] : denied } : {}),
            ...(scope === "county" && countyId ? { countyId } : {}),
            ...(scope === "sport" && sportId ? { sportId } : {}),
            ...(pw ? { password: pw } : {}),
          })}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest-800 py-3 text-sm font-bold text-white"
        >
          {busy ? <ButtonSpinner /> : <Save size={16} />} Save changes
        </button>
      </fieldset>

      {!self && !locked && (
        <div className="rounded-xl border border-line p-4">
          <p className="text-sm font-bold">{u.active ? "Sign-in is enabled" : "Sign-in is disabled"}</p>
          <p className="mt-1 text-xs text-ink-3">Disabling blocks sign-in immediately. Their past actions remain in the audit log.</p>
          <button onClick={() => save({ active: !u.active })} className={`mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${u.active ? "bg-red-100 text-kenya-red-deep" : "bg-leaf-soft text-leaf"}`}>
            {u.active ? <><UserX size={16} /> Disable account</> : <><UserCheck size={16} /> Enable account</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────── role rights ───────── */
function EvidenceCard({ canEdit }: { canEdit: boolean }) {
  const { state, refresh, notify } = useStore();
  const rule = state.config.evidence;
  const [r, setR] = useState(rule);
  const [busy, setBusy] = useState(false);
  const LEVELS = ["Professional", "Semi-Professional", "Amateur", "Youth / Junior", "Community"];
  const dirty = JSON.stringify(r) !== JSON.stringify(rule);
  const save = async () => {
    setBusy(true);
    try {
      await api("/control/evidence", "PUT", { enabled: r.enabled, levels: r.levels, sports: r.sports, clubDocuments: r.clubDocuments });
      await refresh();
      notify("Evidence rule updated. It applies to new approvals immediately.");
    } catch (e) {
      notify(errText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Evidence required for approval" className="lg:col-span-2">
      <p className="mb-3 text-sm text-ink-2">An individual player (not added by a verified club) at the chosen levels needs a trial video <b>or</b> federation endorsement before the Registrar can approve. Officers can always request a video for anyone.</p>
      <fieldset disabled={!canEdit} className="space-y-4">
        <label className="flex items-center gap-2.5 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-forest-700" checked={r.enabled} onChange={(e) => setR({ ...r, enabled: e.target.checked })} /> Enforce this rule</label>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <label key={l} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-forest-700" checked={r.levels.includes(l)} onChange={() => setR({ ...r, levels: r.levels.includes(l) ? r.levels.filter((x) => x !== l) : [...r.levels, l] })} /> {l}
            </label>
          ))}
        </div>
        <label className="block text-sm"><span className="mb-1 block font-semibold">Only for these sports (leave empty for all)</span>
          <select multiple className={`${inputCls} h-32`} value={r.sports} onChange={(e) => setR({ ...r, sports: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
            {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2.5 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-forest-700" checked={r.clubDocuments} onChange={(e) => setR({ ...r, clubDocuments: e.target.checked })} /> Clubs must upload their constitution or registration documents before approval</label>
        <button type="button" disabled={!dirty || busy} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-30">{busy ? <ButtonSpinner /> : <Check size={15} />} Save rule</button>
      </fieldset>
    </Card>
  );
}

function Roles({ ov, canRights, reload }: { ov: Overview; canRights: boolean; reload: () => void }) {
  const { notify, refresh } = useStore();
  const [draft, setDraft] = useState<Record<string, Permission[]>>(() => Object.fromEntries(ov.roles.map((r) => [r.id, r.perms])));
  const [busy, setBusy] = useState("");
  const save = async (id: string, perms: Permission[]) => {
    setBusy(id);
    try {
      await api(`/control/roles/${id}`, "PUT", { perms });
      notify("Role rights updated. They apply immediately.");
      await Promise.all([reload(), refresh()]);
    } catch (e) {
      notify(errText(e), "error");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <EvidenceCard canEdit={canRights} />
      {ov.roles.map((r) => {
        const cur = draft[r.id] ?? r.perms;
        const dirty = cur.slice().sort().join() !== r.perms.slice().sort().join();
        const custom = r.perms.slice().sort().join() !== r.defaults.slice().sort().join();
        const info = ROLE_BY_ID[r.id];
        return (
          <Card key={r.id} title={info.label} action={custom ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Customised</span> : null}>
            <p className="mb-3 text-sm text-ink-2">{info.summary}</p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {ov.catalog.map((p) => (
                <li key={p}>
                  <label className={`flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13px] ${r.locked || !canRights ? "opacity-70" : "cursor-pointer hover:bg-bone"}`}>
                    <input type="checkbox" className="h-4 w-4 accent-forest-700" disabled={r.locked || !canRights} checked={r.locked || cur.includes(p)}
                      onChange={() => setDraft({ ...draft, [r.id]: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] })} />
                    {PERMISSION_LABELS[p]}
                  </label>
                </li>
              ))}
            </ul>
            {r.locked ? (
              <p className="mt-3 text-xs text-ink-3">The Super Administrator always holds every right.</p>
            ) : canRights && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={!dirty || !!busy} onClick={() => save(r.id, cur)} className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-30">
                  {busy === r.id ? <ButtonSpinner /> : <Check size={15} />} Apply
                </button>
                <button disabled={!!busy || !custom && !dirty} onClick={() => { setDraft({ ...draft, [r.id]: r.defaults }); if (custom) save(r.id, r.defaults); }} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ink-2 disabled:opacity-30">
                  <RotateCcw size={15} /> Restore defaults
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── coverage ───────── */
function Coverage({ ov, assign }: { ov: Overview; assign: (a: { role: RoleId; countyId?: string; sportId?: string }) => void }) {
  const [q, setQ] = useState("");
  const f = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const cGaps = ov.coverage.counties.filter((c) => c.officers === 0).length;
  const sGaps = ov.coverage.sports.filter((s) => s.admins === 0).length;
  return (
    <>
      <p className="mb-4 flex gap-2.5 rounded-xl bg-white p-4 text-sm text-ink-2 ring-1 ring-line">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          Every application is first reviewed by the county officer and endorsed by the sport&apos;s federation. <b>{cGaps}</b> counties have no officer and <b>{sGaps}</b> sports have
          no federation administrator, so applications there cannot progress through that step.
        </span>
      </p>
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={`${inputCls} pl-10`} placeholder="Search a county or sport…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Counties: county sports officers">
          <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
            {ov.coverage.counties.filter((c) => f(c.name)).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="flex items-center gap-3">
                  {c.pending > 0 && <span className="text-xs text-ink-3">{c.pending} pending</span>}
                  {c.officers > 0 ? <Pill>Approved</Pill> : <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-kenya-red-deep">No officer</span>}
                  <button onClick={() => assign({ role: "county_officer", countyId: c.id })} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-forest-800 hover:bg-bone">{c.officers ? "Add another" : "Assign"}</button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Sports: federation administrators">
          <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
            {ov.coverage.sports.filter((s) => f(s.name)).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold">{s.name}</span>
                <span className="flex items-center gap-3">
                  {s.pending > 0 && <span className="text-xs text-ink-3">{s.pending} pending</span>}
                  {s.admins > 0 ? <Pill>Approved</Pill> : <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-kenya-red-deep">No administrator</span>}
                  <button onClick={() => assign({ role: "federation_admin", sportId: s.id })} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-forest-800 hover:bg-bone">{s.admins ? "Add another" : "Assign"}</button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

/* ───────── applicant accounts ───────── */
function Applicants({ updateStaff }: { updateStaff: ReturnType<typeof useStore>["updateStaff"] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const load = useCallback(async (needle: string) => {
    const r = await api<{ total: number; members: MemberRow[] }>(`/control/members?q=${encodeURIComponent(needle)}`);
    setRows(r.members);
    setTotal(r.total);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q).catch(() => setRows([])), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <Card title={`Applicant accounts (${total})`}>
      <div className="relative mb-3 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={`${inputCls} pl-10`} placeholder="Search by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!rows ? <BlockLoader label="Loading accounts" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-3">
                <th className="py-2.5 pr-3 font-semibold">Name</th><th className="py-2.5 pr-3 font-semibold">Contact</th>
                <th className="py-2.5 pr-3 font-semibold">Registrations</th><th className="py-2.5 pr-3 font-semibold">Joined</th><th className="py-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-line/70">
                  <td className={`py-3 pr-3 font-semibold ${m.active ? "" : "text-ink-3 line-through"}`}>{m.name}</td>
                  <td className="py-3 pr-3 text-ink-2">{m.email}<span className="block text-xs text-ink-3">{m.phone}</span></td>
                  <td className="py-3 pr-3">{m.registrations}</td>
                  <td className="py-3 pr-3 text-ink-3">{new Date(m.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</td>
                  <td className="py-3 text-right">
                    <button onClick={async () => { if (await updateStaff(m.id, { active: !m.active })) load(q); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-bone">
                      {m.active ? <><KeyRound size={13} /> Block sign-in</> : <><UserCheck size={13} /> Restore</>}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-ink-3">No accounts match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
