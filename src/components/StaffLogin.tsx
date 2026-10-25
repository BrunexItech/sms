"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api";
import { errText, useStore } from "@/lib/store";
import { Logo } from "./Logo";
import { Field, inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";

const DEMO_STAFF = [
  ["Super administrator", "super.admin@sports.example.ke"],
  ["Sports Registrar", "registrar@sports.example.ke"],
  ["County officer, Nairobi", "nairobi.sports@sports.example.ke"],
  ["Federation admin, Athletics", "membership@athletics.example.ke"],
  ["Facilities officer", "facilities@sports.example.ke"],
  ["Finance officer", "finance@sports.example.ke"],
  ["Integrity officer", "integrity@sports.example.ke"],
  ["System administrator", "ict@sports.example.ke"],
];

/** Separate entrance for Ministry and federation staff. Applicants use /login. */
export function StaffLogin() {
  const { login, me, logout, state } = useStore();
  const router = useRouter();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !pw) return setErr("Enter your official email and password.");
    setBusy(true);
    setErr("");
    try {
      const u = await login(id.trim(), pw, code, "staff");
      router.push(u.mustChangePassword || u.needs2fa ? "/security" : "/console");
    } catch (x) {
      if (x instanceof ApiError && x.status === 428) {
        setNeedCode(true);
      } else setErr(errText(x));
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-forest-950 to-forest-900 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo light /></div>
        <div className="rounded-2xl bg-white p-7 shadow-2xl sm:p-8">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-forest-700"><ShieldCheck size={15} /> Staff portal</p>
          <h1 className="mt-1 text-xl font-bold text-forest-900">Sign in to the console</h1>
          <p className="mt-1 text-sm text-ink-3">For Ministry offices, county officers and federation administrators.</p>

          {me?.staff ? (
            <div className="mt-6 rounded-xl bg-forest-100 p-4 text-sm">
              Signed in as <b>{me.name}</b>. <Link href="/console" className="font-bold text-forest-700 underline">Open the console</Link> or{" "}
              <button onClick={logout} className="font-bold text-kenya-red underline">sign out</button>.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Official email">
                <input className={inputCls} type="email" autoComplete="username" value={id} onChange={(e) => { setId(e.target.value); setErr(""); }} />
              </Field>
              <Field label="Password" error={needCode ? undefined : err}>
                <div className="relative">
                  <input className={`${inputCls} pr-12`} type={show ? "text" : "password"} autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              {needCode && (
                <Field label="Authenticator code" hint="Enter the 6-digit code from your authenticator app." error={err}>
                  <input className={inputCls} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                </Field>
              )}
              <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-forest-800 to-forest-900 py-3.5 text-[15px] font-bold text-white disabled:opacity-80">
                {busy ? <ButtonSpinner /> : <ArrowRight size={17} />} Sign in
              </button>
              <p className="text-right text-sm"><Link href="/forgot" className="font-bold text-forest-700 underline">Forgot your password?</Link></p>
            </form>
          )}
        </div>

        {state.config.demo && (
          <div className="mt-5 rounded-2xl bg-white/10 p-5 text-white backdrop-blur">
            <p className="text-sm font-bold">Demo staff accounts <span className="font-normal text-white/70">(password Sports@2026!)</span></p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {DEMO_STAFF.map(([label, email]) => (
                <li key={email}>
                  <button type="button" onClick={() => { setId(email); setPw("Sports@2026!"); setErr(""); }} className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10">{label}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-5 text-center text-xs text-white/60">
          Player or club? <Link href="/login" className="font-bold text-white underline">Applicant sign-in</Link> · <Link href="/" className="underline">Back to the public site</Link>
        </p>
      </div>
    </main>
  );
}
