"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { ApiError } from "@/lib/api";
import { errText, useStore } from "@/lib/store";
import { Field, inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";

// Seeded demo accounts (prototype data only; real deployments set their own passwords).
// Seeded demo accounts (demo deployments only).
const DEMO_APPLICANTS = [
  ["Club manager (verified club)", "club.manager@example.co.ke"],
  ["Player (awaiting verification)", "player@example.co.ke"],
];

export function LoginView() {
  const { login, me, logout, state } = useStore();
  const router = useRouter();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !pw) return setErr("Enter your email or phone and your password.");
    setBusy(true);
    setErr("");
    try {
      const u = await login(id.trim(), pw, code, "member");
      router.push(u.mustChangePassword || u.needs2fa ? "/security" : u.staff ? "/console" : "/account");
    } catch (x) {
      if (x instanceof ApiError && x.status === 428) {
        setNeedCode(true);
        setErr("");
      } else setErr(errText(x));
      setBusy(false);
    }
  };

  return (
    <div className={`mx-auto grid gap-6 px-5 pb-24 ${state.config.demo ? "max-w-[1100px] lg:grid-cols-[1fr_1fr]" : "max-w-lg"}`}>
      <section className="-mt-8 self-start rounded-2xl border border-line bg-white p-6 shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)] sm:p-8">
        <h2 className="text-xl font-bold text-forest-900">Sign in</h2>
        {me ? (
          <div className="mt-6 rounded-xl bg-forest-100 p-4 text-sm">
            Signed in as <b>{me.name}</b>.{" "}
            <Link href={me.staff ? "/console" : "/account"} className="font-bold text-forest-700 underline">Continue</Link> or{" "}
            <button onClick={logout} className="font-bold text-kenya-red underline">sign out</button>.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email or phone number">
              <input className={inputCls} autoComplete="username" value={id} onChange={(e) => { setId(e.target.value); setErr(""); }} placeholder="you@example.co.ke" />
            </Field>
            {needCode && (
              <Field label="Authenticator code" hint="Open your authenticator app and enter the 6-digit code.">
                <input className={inputCls} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </Field>
            )}
            <Field label="Password" error={err}>
              <div className="relative">
                <input className={`${inputCls} pr-12`} type={show ? "text" : "password"} autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-forest-800 to-forest-900 py-3.5 text-[15px] font-bold text-white disabled:opacity-80">
              {busy ? <ButtonSpinner /> : <ArrowRight size={17} />} Sign in
            </button>
            <p className="text-right text-sm"><Link href="/forgot" className="font-bold text-forest-700 underline">Forgot your password?</Link></p>
          </form>
        )}
        <p className="mt-5 text-sm text-ink-2">
          New here? <Link href="/register" className="font-bold text-forest-700 underline">Register as a player or apply as a club</Link>.
        </p>
      </section>

      {state.config.demo && (
      <section className="rounded-2xl border border-line bg-white p-6 sm:p-8 lg:-mt-8">
        <h2 className="text-base font-bold text-forest-900">Demo applicant accounts</h2>
        <p className="mt-3 flex gap-2.5 rounded-lg border-l-4 border-gold bg-gold-soft p-3 text-[12.5px] text-ink-2">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          Seeded for review only. Password for all: <b className="font-mono">Sports@2026!</b>. A live deployment sets its own and removes these.
        </p>
        <ul className="mt-4 divide-y divide-line">
          {DEMO_APPLICANTS.map(([label, email]) => (
            <li key={email}>
              <button
                type="button"
                onClick={() => { setId(email); setPw("Sports@2026!"); setErr(""); }}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm transition hover:text-forest-700"
              >
                <span className="font-semibold">{label}</span>
                <span className="truncate font-mono text-[11.5px] text-ink-3">{email}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      )}
    </div>
  );
}
