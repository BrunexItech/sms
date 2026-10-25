"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Info } from "lucide-react";
import { SPORT_BY_ID } from "@/data/sports";
import { emptyPlace } from "@/lib/admin";
import { api } from "@/lib/api";
import { errText, useStore } from "@/lib/store";
import {
  COMPETITION_LEVELS,
  PERSONNEL_TYPES,
  STAKEHOLDER_TYPES,
  type ClubOfficial,
  REQUIRED_OFFICIALS,
  type Application,
  type GeoPoint,
  type Place,
  type StakeholderType,
} from "@/lib/types";
import { DEFAULT_OFFICIALS, OfficialsEditor } from "./OfficialsEditor";
import { RolePicker } from "./RolePicker";
import { LocationFields } from "./LocationFields";
import { SportPicker } from "./SportPicker";
import { Field, inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";
import { PayBox } from "./PayBox";

const STEPS = ["Details", "Location", "Sports Details", "Review"] as const;

const REG_NO_TYPES: StakeholderType[] = ["Club", "Academy", "Federation / Association", "County Branch"];
/** Organisations that name a president, secretary and treasurer. */
const OFFICIAL_TYPES: StakeholderType[] = ["Club", "Federation / Association", "County Branch"];
/** Entry points shown first; every other type sits under "Coach, official or other". */
const ENTRY: [StakeholderType, string][] = [
  ["Federation / Association", "A national federation"],
  ["County Branch", "A county branch"],
  ["Club", "A club"],
  ["Player / Sportsperson", "A player"],
];
const isEntry = (t: StakeholderType) => ENTRY.some(([e]) => e === t);

export const ORG_TYPES: StakeholderType[] = [
  "Club",
  "Academy",
  "Technical Team",
  "Sports Business",
  "Facility Operator",
  "Event Organiser",
  "Federation / Association",
  "County Branch",
];

export const DEMO_OTP = "123456";

interface Form {
  type: StakeholderType;
  name: string;
  idNo: string;
  kra: string;
  phone: string;
  email: string;
  place: Place;
  gps?: GeoPoint;
  sport: string;
  level: string;
  password: string;
  confirm: string;
  clubName: string;
  orgRegNo: string;
  parentId: string;
  officials: ClubOfficial[];
  role: string;
  sportOther: string;
  hasContract: "" | "Yes" | "No";
  notes: string;
  dob: string;
  gender: string;
  gName: string;
  gPhone: string;
  gRel: string;
  gConsent: boolean;
  publicListing: boolean;
  website: string;
}

type Errors = Partial<Record<string, string>>;

function ageOf(dob: string): number {
  const d = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}

function validate(step: number, f: Form, needPassword = false): Errors {
  const e: Errors = {};
  if (step === 1) {
    const org = ORG_TYPES.includes(f.type);
    if (org && f.clubName.trim().length < 3) e.clubName = "Enter the organisation name.";
    if (REG_NO_TYPES.includes(f.type) && !/^[A-Za-z0-9][A-Za-z0-9 /._-]{2,39}$/.test(f.orgRegNo.trim()))
      e.orgRegNo = "Enter the registration number on your certificate.";
    if (f.name.trim().split(/\s+/).length < 2) e.name = org ? "Enter the contact person's full names." : "Enter your full legal names (at least two names).";
    if (!/^[A-Za-z0-9]{6,10}$/.test(f.idNo.trim())) e.idNo = "Enter a valid National ID or passport number.";
    if ((f.kra.trim() || !ORG_TYPES.includes(f.type)) && !/^[AP]\d{9}[A-Z]$/i.test(f.kra.trim())) e.kra = "KRA PIN looks like A012345678Z.";
    if (!/^(?:\+?254|0)?[17]\d{8}$/.test(f.phone.replace(/\s/g, ""))) e.phone = "Use a Kenyan number, e.g. 0712 345 678.";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email address.";
    if (needPassword) {
      if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))
        e.password = "Use at least 8 characters, with letters and a number.";
      if (f.confirm !== f.password) e.confirm = "The passwords do not match.";
    }
  }
  if (step === 2) {
    if (!f.place.countyId) e.county = "Select your county.";
    if (!f.place.subId) e.subCounty = "Select your sub-county.";
    if (!f.place.wardId) e.ward = "Select your ward.";
  }
  if (step === 3) {
    if (!f.sport) e.sport = "Choose a sport.";
    if (OFFICIAL_TYPES.includes(f.type)) {
      for (const need of REQUIRED_OFFICIALS) {
        const o = f.officials.find((x) => x.role === need);
        if (!o || o.name.trim().length < 3) e[`official-${need}`] = "Required.";
      }
    }
    if (f.type === "County Branch" && !f.parentId) e.parentId = "Choose the national federation your branch belongs to.";
    if (PERSONNEL_TYPES.includes(f.type) && !f.role) e.role = "Choose your role from the list.";
    if (f.sport === "other" && f.sportOther.trim().length < 3) e.sportOther = "Tell us the name of the sport. The Registrar will review it.";
    if (f.type === "Player / Sportsperson") {
      if (!f.hasContract) e.hasContract = "Please answer this question.";
      const born = Date.parse(f.dob);
      if (!f.dob || Number.isNaN(born) || born > Date.now()) e.dob = "Enter the date of birth.";
      if (!f.gender) e.gender = "Choose a category (used for competition categories).";
      if (!e.dob && ageOf(f.dob) < 18) {
        if (f.gName.trim().length < 3) e.gName = "Enter the parent or guardian's name.";
        if (!f.gRel.trim()) e.gRel = "Enter the relationship.";
        if (!/^(?:\+?254|0)?[17]\d{8}$/.test(f.gPhone.replace(/\s/g, ""))) e.gPhone = "Enter the guardian's phone number.";
        if (!f.gConsent) e.gConsent = "A parent or guardian must consent.";
      }
    }
  }
  return e;
}

export function RegistrationFlow({
  compact = false,
  presetSport = null,
}: {
  /** Embedded in the home page grid (no page chrome). */
  compact?: boolean;
  /** Sport chosen elsewhere on the page (for example the strip under the hero). */
  presetSport?: string | null;
}) {
  const { state, register, member, user, federationName } = useStore();
  const qs = useSearchParams();
  const queryPreset = qs.get("sport");
  const asParam = qs.get("as");
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Application | null>(null);
  const [serverError, setServerError] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<Form>({
    type: ({ club: "Club", federation: "Federation / Association", branch: "County Branch" } as Record<string, StakeholderType>)[asParam ?? ""] ?? "Player / Sportsperson",
    name: "",
    idNo: "",
    kra: "",
    phone: "",
    email: "",
    place: emptyPlace(),
    sport: "",
    level: "Amateur",
    password: "",
    confirm: "",
    clubName: "",
    orgRegNo: "",
    parentId: "",
    officials: DEFAULT_OFFICIALS,
    role: "",
    sportOther: "",
    hasContract: "",
    notes: "",
    dob: "",
    gender: "",
    gName: "",
    gPhone: "",
    gRel: "",
    gConsent: false,
    publicListing: false,
    website: "",
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // The sport the visitor explicitly picked here wins; otherwise one chosen elsewhere on the page or in the URL.
  const preset = presetSport ?? (queryPreset && SPORT_BY_ID[queryPreset] ? queryPreset : "");
  const sport = form.sport || preset;
  const eff: Form = { ...form, sport };
  const federation = sport ? federationName(sport) : "";
  const fee = state.fees[form.type];
  const isOrg = ORG_TYPES.includes(form.type);
  const [nationals, setNationals] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    const sp = form.sport || preset;
    if (form.type !== "County Branch" || !sp) return;
    let off = false;
    api<{ rows: { id: string; name: string }[] }>(`/federations/${encodeURIComponent(sp)}/national`)
      .then((r) => !off && setNationals(r.rows))
      .catch(() => !off && setNationals([]));
    return () => { off = true; };
  }, [form.type, form.sport, preset]);

  const go = (n: number) => {
    if (n > step) {
      const e = validate(step, eff, !member);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setStep(n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const submit = async () => {
    setBusy(true);
    setServerError("");
    try {
      const minor = form.type === "Player / Sportsperson" && form.dob && ageOf(form.dob) < 18;
      const app = await register({
        type: form.type,
        name: form.name.trim(),
        idNo: form.idNo.trim(),
        kra: form.kra.trim().toUpperCase(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: member ? undefined : form.password,
        place: form.place,
        gps: form.gps,
        sport,
        level: form.level,
        clubName: form.clubName.trim(),
        orgRegNo: form.orgRegNo.trim(),
        parentId: form.type === "County Branch" ? form.parentId : undefined,
        clubOfficials: OFFICIAL_TYPES.includes(form.type) ? form.officials.filter((o) => o.name.trim()).map((o) => ({ ...o, name: o.name.trim() })) : undefined,
        role: PERSONNEL_TYPES.includes(form.type) || form.type === "Player / Sportsperson" ? form.role || undefined : undefined,
        sportOther: sport === "other" ? form.sportOther.trim() : undefined,
        hasContract: form.hasContract || undefined,
        notes: form.notes,
        publicListing: form.type === "Player / Sportsperson" ? form.publicListing : undefined,
        dob: form.type === "Player / Sportsperson" ? form.dob : undefined,
        gender: form.type === "Player / Sportsperson" ? form.gender : undefined,
        guardian: minor ? { name: form.gName.trim(), phone: form.gPhone.trim(), relationship: form.gRel.trim(), consent: true } : undefined,
        website: form.website,
      });
      setDone(app);
      top.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      setServerError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const shell = compact
    ? "h-full rounded-2xl border border-line bg-white shadow-[0_18px_40px_-28px_rgba(6,45,87,0.5)]"
    : "overflow-hidden rounded-2xl border border-line bg-white shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)]";

  const frame = (inner: React.ReactNode) =>
    compact ? (
      <div ref={top} className={shell}>{inner}</div>
    ) : (
      <div className="mx-auto max-w-3xl px-5 pb-24">
        <div ref={top} className={`-mt-8 ${shell}`}>{inner}</div>
      </div>
    );

  if (done) return frame(<Success app={done} compact={compact} />);
  if (user)
    return frame(
      <div className="p-6 text-center">
        <h2 className="text-xl font-extrabold text-forest-900">You are signed in as staff</h2>
        <p className="mt-2 text-sm text-ink-2">Ministry and federation accounts review registrations; they cannot submit them. Sign out to register as an applicant.</p>
        <Link href="/console" className="mt-4 inline-block rounded-xl bg-forest-800 px-5 py-2.5 text-sm font-bold text-white">Open the console</Link>
      </div>,
    );

  const pad = compact ? "px-5" : "px-6 sm:px-9";

  return frame(
    <div className="flex h-full flex-col">
      <div className={`${pad} pb-1 pt-5`}>
        <h2 className="text-2xl font-extrabold tracking-tight text-forest-900">Register Now</h2>
        <p className="mt-1 text-sm text-ink-3">Join the national sports database in compliance with the Sports Act.</p>

        <ol className="relative mt-5 grid grid-cols-4">
          <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[15px] h-[3px] rounded bg-line" />
          <span aria-hidden className="absolute left-[12.5%] top-[15px] h-[3px] rounded bg-forest-700 transition-all duration-500" style={{ width: `${((step - 1) / 3) * 75}%` }} />
          {STEPS.map((s, i) => {
            const n = i + 1;
            const complete = n < step;
            const active = n === step;
            return (
              <li key={s} className="relative flex flex-col items-center text-center">
                <span
                  aria-current={active ? "step" : undefined}
                  className={`grid h-[33px] w-[33px] place-items-center rounded-full text-[13px] font-bold transition ${
                    complete || active ? "bg-forest-700 text-white" : "bg-line text-ink-2"
                  } ${active ? "ring-4 ring-forest-700/15" : ""}`}
                >
                  {complete ? <Check size={15} strokeWidth={3} /> : n}
                </span>
                <span className={`mt-2 text-[11.5px] leading-tight ${active ? "font-bold text-forest-700" : "font-medium text-ink-3"}`}>{s}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={`${pad} flex-1 py-5`}>
        <div key={step} className="step-anim">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-semibold">I am registering as</span>
                <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {ENTRY.map(([t, label]) => (
                    <button key={t} type="button" role="radio" aria-checked={form.type === t} onClick={() => { setForm((f) => ({ ...f, type: t, role: "", parentId: "" })); setErrors({}); }}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${form.type === t ? "border-forest-700 bg-forest-100 text-forest-900" : "border-line bg-white text-ink-2 hover:border-forest-700/50"}`}>{label}</button>
                  ))}
                  <button type="button" role="radio" aria-checked={!isEntry(form.type)} onClick={() => { setForm((f) => ({ ...f, type: isEntry(f.type) ? "Coach" : f.type, role: "", parentId: "" })); setErrors({}); }}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${!isEntry(form.type) ? "border-forest-700 bg-forest-100 text-forest-900" : "border-line bg-white text-ink-2 hover:border-forest-700/50"}`}>Coach, official or other</button>
                </div>
                {!isEntry(form.type) && (
                  <select aria-label="Type" className={`${inputCls} mt-2`} value={form.type}
                    onChange={(e) => { setForm((f) => ({ ...f, type: e.target.value as StakeholderType, role: "" })); setErrors({}); }}>
                    {STAKEHOLDER_TYPES.filter((t) => !isEntry(t)).map((t) => <option key={t}>{t}</option>)}
                  </select>
                )}
              </div>
              {isOrg && (
                <fieldset className="grid gap-4 rounded-xl border border-line bg-bone p-4 sm:col-span-2 sm:grid-cols-2">
                  <legend className="px-2 text-[13px] font-semibold">Organisation</legend>
                  <Field label={`${form.type === "Club" ? "Club" : form.type === "Federation / Association" ? "Federation" : form.type === "County Branch" ? "Branch" : "Organisation"} name`} required error={errors.clubName} className="sm:col-span-2" hint="Names are checked for uniqueness before approval.">
                    <input className={inputCls} placeholder={form.type === "Federation / Association" ? "e.g. Kenya Volleyball Federation" : form.type === "County Branch" ? "e.g. Nakuru County Volleyball Association" : "e.g. Kibera Stars FC"} value={form.clubName} onChange={(e) => set("clubName", e.target.value)} />
                  </Field>
                  <Field label="Registration number" required={REG_NO_TYPES.includes(form.type)} error={errors.orgRegNo}
                    hint="From your Registrar of Societies, company or Sports Registrar certificate.">
                    <input className={inputCls} placeholder="e.g. SOC/2019/04512" value={form.orgRegNo} onChange={(e) => set("orgRegNo", e.target.value)} />
                  </Field>
                  <Field label="Organisation KRA PIN (optional)" error={errors.kra}>
                    <input className={inputCls} placeholder="Enter KRA PIN" value={form.kra} onChange={(e) => set("kra", e.target.value.toUpperCase().slice(0, 11))} />
                  </Field>
                </fieldset>
              )}
              <Field label={isOrg ? "Contact person: full names" : "Full Names"} required error={errors.name} className="sm:col-span-2"
                hint={isOrg ? "The officer who manages this account and answers to the Ministry." : undefined}>
                <input className={inputCls} placeholder="Enter full names" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
              </Field>
              <Field label={isOrg ? "Contact person: ID number" : "ID Number"} required error={errors.idNo} className={isOrg ? "sm:col-span-2" : undefined}>
                <input className={inputCls} placeholder="Enter ID number" value={form.idNo} onChange={(e) => set("idNo", e.target.value)} />
              </Field>
              {!isOrg && (
                <Field label="KRA PIN Number" required error={errors.kra}>
                  <input className={inputCls} placeholder="Enter KRA PIN" value={form.kra} onChange={(e) => set("kra", e.target.value.toUpperCase().slice(0, 11))} />
                </Field>
              )}
              <Field label={isOrg ? "Contact phone number" : "Phone Number"} required error={errors.phone} className="sm:col-span-2">
                <div className="flex overflow-hidden rounded-xl border border-line bg-white focus-within:border-forest-700 focus-within:ring-4 focus-within:ring-forest-700/12">
                  <span className="flex items-center gap-2 border-r border-line bg-bone px-3 text-sm font-semibold text-ink-2">
                    <span aria-hidden className="inline-block h-3.5 w-5 overflow-hidden rounded-[2px]" style={{ background: "linear-gradient(#000 0 31%,#fff 31% 36%,#c62828 36% 64%,#fff 64% 69%,#148a45 69%)" }} />
                    +254
                  </span>
                  <input className="w-full px-3.5 py-3 text-[15px] outline-none" inputMode="tel" placeholder="Enter phone number" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
                </div>
              </Field>
              <Field label={isOrg ? "Contact email address" : "Email Address"} required error={errors.email} className="sm:col-span-2">
                <input className={inputCls} type="email" placeholder="Enter email address" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
              </Field>
              {member ? (
                <p className="rounded-lg bg-forest-100 px-3.5 py-2.5 text-[13px] text-forest-900 sm:col-span-2">
                  Signed in as <b>{member.name}</b>. This registration will be added to your account.
                </p>
              ) : (
                <>
                  <Field label="Create a password" required error={errors.password} hint="At least 8 characters, with letters and a number.">
                    <input className={inputCls} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
                  </Field>
                  <Field label="Confirm password" required error={errors.confirm}>
                    <input className={inputCls} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
                  </Field>
                  <p className="text-[12.5px] text-ink-3 sm:col-span-2">
                    Already registered? <Link href="/login" className="font-bold text-forest-700 underline">Sign in</Link> to add another registration.
                  </p>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <LocationFields
              place={form.place}
              onPlace={(p) => {
                setForm((f) => ({ ...f, place: p }));
                setErrors({});
              }}
              gps={form.gps}
              onGps={(g) => set("gps", g)}
              errors={errors}
            />
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Competition level">
                <select className={inputCls} value={form.level} onChange={(e) => set("level", e.target.value)}>
                  {COMPETITION_LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-semibold">
                  Sport <span className="text-kenya-red">*</span>
                  {sport && <span className="ml-2 font-normal text-ink-3">Selected: {SPORT_BY_ID[sport]?.name}</span>}
                </span>
                <SportPicker
                  compact={compact}
                  value={sport ? [sport] : []}
                  onChange={(v) => {
                    set("sport", v[0] ?? "");
                    set("parentId", "");
                  }}
                />
                {errors.sport && <span className="mt-1.5 block text-xs font-medium text-kenya-red">{errors.sport}</span>}
              </div>

              <Field label="Federation / governing body" className="sm:col-span-2" hint="Set automatically from the sport you chose.">
                <input className={inputCls} readOnly value={federation || "Choose a sport first"} />
              </Field>

              {sport === "other" && (
                <Field label="Name of the sport" required error={errors.sportOther} className="sm:col-span-2" hint="The Registrar reviews new sports before they join the directory.">
                  <input className={inputCls} value={form.sportOther} onChange={(e) => set("sportOther", e.target.value)} />
                </Field>
              )}

              {(PERSONNEL_TYPES.includes(form.type) || form.type === "Player / Sportsperson") && (
                <RolePicker roles={state.roles} type={form.type} sport={sport} value={form.role} onChange={(v) => set("role", v)} error={errors.role}
                  optional={form.type === "Player / Sportsperson"} />
              )}

              {form.type === "County Branch" && (
                <Field label="National federation" required error={errors.parentId} className="sm:col-span-2"
                  hint={!sport ? "Choose the sport first." : nationals && nationals.length === 0 ? "No national federation is verified for this sport yet. The federation must register and be verified first." : "Your branch is endorsed by this federation."}>
                  <select className={inputCls} value={form.parentId} onChange={(e) => set("parentId", e.target.value)} disabled={!nationals?.length}>
                    <option value="">{nationals?.length ? "Select the national federation" : "None available"}</option>
                    {(nationals ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </Field>
              )}

              {OFFICIAL_TYPES.includes(form.type) && (
                <OfficialsEditor roles={state.roles} value={form.officials} onChange={(v) => set("officials", v)} errors={errors} />
              )}

              {form.type === "Player / Sportsperson" && (
                <fieldset className="grid gap-4 rounded-xl border border-line bg-bone p-4 sm:col-span-2 sm:grid-cols-2">
                  <legend className="px-2 text-[13px] font-semibold">Player profile</legend>
                  <Field label="Date of birth" required error={errors.dob}>
                    <input className={inputCls} type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={(e) => set("dob", e.target.value)} />
                  </Field>
                  <Field label="Competition category" required error={errors.gender}>
                    <select className={inputCls} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                      <option value="">Select</option>
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </Field>
                  {form.dob && ageOf(form.dob) < 18 && (
                    <div className="grid gap-4 rounded-lg border border-gold bg-gold-soft p-3.5 sm:col-span-2 sm:grid-cols-3">
                      <p className="text-[13px] font-semibold text-forest-900 sm:col-span-3">The player is under 18: a parent or guardian must give consent.</p>
                      <Field label="Parent / guardian name" required error={errors.gName}><input className={inputCls} value={form.gName} onChange={(e) => set("gName", e.target.value)} /></Field>
                      <Field label="Relationship" required error={errors.gRel}><input className={inputCls} placeholder="e.g. Mother" value={form.gRel} onChange={(e) => set("gRel", e.target.value)} /></Field>
                      <Field label="Guardian phone" required error={errors.gPhone}><input className={inputCls} inputMode="tel" value={form.gPhone} onChange={(e) => set("gPhone", e.target.value)} /></Field>
                      <label className="flex items-start gap-2.5 text-[13px] sm:col-span-3">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-forest-700" checked={form.gConsent} onChange={(e) => set("gConsent", e.target.checked)} />
                        <span>I am the parent or legal guardian and consent to this registration and to the processing of the player&apos;s data for it.</span>
                      </label>
                      {errors.gConsent && <p className="text-xs font-medium text-kenya-red sm:col-span-3">{errors.gConsent}</p>}
                    </div>
                  )}
                </fieldset>
              )}

              {form.type === "Player / Sportsperson" && (
                <label className="flex items-start gap-2.5 rounded-xl border border-line bg-bone p-3.5 text-[13px] sm:col-span-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-forest-700" checked={form.publicListing} onChange={(e) => set("publicListing", e.target.checked)} />
                  <span>
                    Show my name, role and sport on my club&apos;s public page once I am verified.
                    {form.dob && ageOf(form.dob) < 18 && " For a player under 18, the parent or guardian agrees to this."} You can change this later. Nothing else is shown.
                  </span>
                </label>
              )}

              {form.type === "Player / Sportsperson" && (
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-[13px] font-semibold">
                    Do you have a current player contract? <span className="text-kenya-red">*</span>
                  </span>
                  <div className="flex gap-3">
                    {(["Yes", "No"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={form.hasContract === v}
                        onClick={() => set("hasContract", v)}
                        className={`rounded-xl border px-6 py-2.5 text-sm font-semibold transition ${form.hasContract === v ? "border-forest-700 bg-forest-100 text-forest-800" : "border-line bg-white hover:border-forest-700/50"}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {errors.hasContract && <span className="mt-1.5 block text-xs font-medium text-kenya-red">{errors.hasContract}</span>}
                </div>
              )}

              <Field label="Registration notes / additional details" className="sm:col-span-2">
                <input className={inputCls} placeholder="Licence, role, facility details, etc." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-b from-forest-800 to-forest-900 p-4 text-white">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gold">{form.type}</p>
                  <p className="mt-0.5 text-sm text-white/80">{form.clubName || form.name}</p>
                </div>
                <p className="text-3xl font-extrabold">
                  <span className="mr-1.5 text-sm font-semibold text-white/70">KSh</span>
                  {fee.toLocaleString()}
                </p>
              </div>
              <ul className="space-y-2 text-sm text-ink-2">
                <li>1. Submit your registration to create your account.</li>
                <li>2. Pay the fee. {state.config.mpesa ? "You will get an M-Pesa prompt on your phone." : "Demo mode: no money moves."}</li>
                <li>3. Your County Sports Office, your federation and the Registrar verify it.</li>
                {form.type === "Player / Sportsperson" && <li>4. Optional: add a profile photo and trial video from My account.</li>}
              </ul>
              {/* honeypot: hidden from people, tempting to bots */}
              <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={form.website} onChange={(e) => set("website", e.target.value)} />
              <p className="mt-5 flex gap-2.5 rounded-lg border-l-4 border-gold bg-gold-soft p-3 text-[12.5px] text-ink-2">
                <Info size={15} className="mt-0.5 shrink-0" />
                Your data is used only to register and verify you under the Sports Act. See the <Link href="/privacy" className="font-bold underline">privacy notice</Link>.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={`${pad} pb-5`}>
        {serverError && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-kenya-red-deep">
            {serverError}
          </p>
        )}
        {step < 4 ? (
          <button
            onClick={() => go(step + 1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-forest-800 to-forest-900 py-3.5 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(6,45,87,0.9)] transition hover:brightness-110"
          >
            {step === 3 ? "Review" : "Next Step"} <ArrowRight size={17} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-leaf py-3.5 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(20,138,69,0.9)] transition hover:brightness-110 disabled:opacity-80"
          >
            {busy ? <ButtonSpinner /> : <Check size={17} />}
            {busy ? "Submitting…" : "Submit registration"}
          </button>
        )}
        {step > 1 && (
          <button onClick={() => go(step - 1)} disabled={busy} className="mx-auto mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-ink-3 transition hover:text-forest-800">
            <ArrowLeft size={15} /> Back
          </button>
        )}
      </div>
    </div>,
  );
}

function Success({ app: first, compact }: { app: Application; compact: boolean }) {
  const { state } = useStore();
  const app = state.applications.find((a) => a.id === first.id) ?? first;
  return (
    <div className={`step-anim mx-auto max-w-xl text-center ${compact ? "p-6" : "p-8 sm:p-12"}`}>
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-leaf-soft text-leaf">
        <CheckCircle2 size={32} />
      </span>
      <h2 className="mt-5 text-2xl font-extrabold text-forest-900">Application submitted</h2>
      <p className="mt-2 text-sm text-ink-2">
        <b>{app.clubName || app.name}</b> applied as <b>{app.type}</b> in <b>{SPORT_BY_ID[app.sport]?.name}</b>.{" "}
        {app.payment.status === "Paid"
          ? "It now waits for verification by your County Sports Office, your federation and the Sports Registrar."
          : "Pay the registration fee below so verification can begin."}{" "}
        {app.type === "Club" ? "Once your club is verified you can register your players." : app.type === "Federation / Association" ? "Once verified you become the federation of record for your sport, and county branches can register under you." : app.type === "County Branch" ? "Your national federation endorses the branch before the Registrar verifies it." : app.type === "Player / Sportsperson" ? "Optional: add a profile photo or trial video from My account whenever you like." : ""}
      </p>
      <dl className="mt-6 grid gap-3 rounded-xl border border-dashed border-forest-700/40 bg-forest-100/50 p-4 text-left text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wider text-ink-3">Reference</dt><dd className="mt-0.5 font-mono font-semibold">{app.id}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-ink-3">Fee paid</dt><dd className="mt-0.5 font-semibold">KSh {app.payment.amount.toLocaleString()}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-ink-3">Location</dt><dd className="mt-0.5">{[app.place.ward, app.place.subCounty, app.place.county].join(", ")}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-ink-3">Federation</dt><dd className="mt-0.5">{app.federation}</dd></div>
      </dl>
      {app.payment.status === "Pending" && (
        <div className="text-left">
          <PayBox ids={[app.id]} amount={app.payment.amount} defaultPhone={app.phone} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/account" className="rounded-xl bg-forest-800 px-6 py-3 text-sm font-bold text-white hover:bg-forest-900">Track my application</Link>
        <Link href="/events" className="rounded-xl border border-line px-6 py-3 text-sm font-bold text-ink-2 hover:bg-bone">See upcoming events</Link>
      </div>
          </div>
  );
}
