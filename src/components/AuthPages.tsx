"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { errText, useStore } from "@/lib/store";
import { Field, inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-lg px-5 pb-24">
    <div className="-mt-8 rounded-2xl border border-line bg-white p-6 shadow-[0_40px_80px_-50px_rgba(6,45,87,0.5)] sm:p-8">{children}</div>
  </div>
);

const strong = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

export function ForgotView() {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ message: string; devLink?: string } | null>(null);
  const [err, setErr] = useState("");
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      setRes(await api("/auth/forgot", "POST", { identifier: id }));
    } catch (x) {
      setErr(errText(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <h2 className="text-2xl font-extrabold text-forest-900">Reset your password</h2>
      {res ? (
        <div className="mt-5 space-y-3 text-sm text-ink-2">
          <p className="flex gap-2"><CheckCircle2 className="shrink-0 text-leaf" size={18} /> {res.message}</p>
          {res.devLink && <p className="rounded-lg bg-gold-soft p-3">Development only (no mail server configured): <Link className="font-bold underline" href={res.devLink}>open the reset link</Link>.</p>}
        </div>
      ) : (
        <form onSubmit={go} className="mt-5 space-y-4">
          <Field label="Email address" error={err}><input className={inputCls} type="email" value={id} onChange={(e) => setId(e.target.value)} autoComplete="email" /></Field>
          <button disabled={busy || !id} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 py-3.5 text-sm font-bold text-white disabled:opacity-60">
            {busy && <ButtonSpinner />} Send reset link
          </button>
        </form>
      )}
      <p className="mt-5 text-sm"><Link href="/login" className="font-bold text-forest-700 underline">Back to sign in</Link></p>
    </Card>
  );
}

export function ResetView() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong(pw)) return setErr("Use at least 8 characters, with letters and a number.");
    if (pw !== pw2) return setErr("The passwords do not match.");
    setBusy(true);
    try {
      await api("/auth/reset", "POST", { token, password: pw });
      setOk(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch (x) {
      setErr(errText(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <h2 className="text-2xl font-extrabold text-forest-900">Choose a new password</h2>
      {!token ? <p className="mt-4 text-sm text-kenya-red">This link is missing its token. Request a new one.</p> : ok ? (
        <p className="mt-5 flex gap-2 text-sm font-semibold text-leaf"><CheckCircle2 size={18} /> Password updated. Taking you to sign in…</p>
      ) : (
        <form onSubmit={go} className="mt-5 space-y-4">
          <Field label="New password"><input className={inputCls} type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} /></Field>
          <Field label="Confirm password" error={err}><input className={inputCls} type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }} /></Field>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 py-3.5 text-sm font-bold text-white disabled:opacity-60">{busy && <ButtonSpinner />} Update password</button>
        </form>
      )}
    </Card>
  );
}

export function SecurityView() {
  const { me, refresh, notify } = useStore();
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [err, setErr] = useState("");
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [err2, setErr2] = useState("");
  if (!me) return <Card><p className="text-sm">Please <Link className="font-bold underline" href="/login">sign in</Link> first.</p></Card>;

  const done = () => router.push(me.staff ? "/console" : "/account");
  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong(nw)) return setErr("Use at least 8 characters, with letters and a number.");
    try {
      await api("/auth/change-password", "POST", { current: cur, new: nw });
      await refresh();
      setCur("");
      setNw("");
      notify("Password changed.");
      if (!me.needs2fa) done();
    } catch (x) {
      setErr(errText(x));
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-extrabold text-forest-900">Account security</h2>
      {me.mustChangePassword && <p className="mt-3 rounded-lg border-l-4 border-gold bg-gold-soft p-3 text-sm">You are using a password someone else set. Choose your own to continue.</p>}
      {me.needs2fa && <p className="mt-3 rounded-lg border-l-4 border-gold bg-gold-soft p-3 text-sm">Staff accounts must turn on two-factor authentication.</p>}

      <form onSubmit={change} className="mt-6 space-y-4">
        <h3 className="font-bold">Change password</h3>
        <Field label="Current password"><input className={inputCls} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="New password" error={err}><input className={inputCls} type="password" autoComplete="new-password" value={nw} onChange={(e) => { setNw(e.target.value); setErr(""); }} /></Field>
        <button className="rounded-xl bg-forest-800 px-6 py-3 text-sm font-bold text-white">Change password</button>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} /> Two-factor authentication</h3>
        {me.totpEnabled ? (
          <p className="mt-2 text-sm font-semibold text-leaf">On. You will be asked for a code from your authenticator app when you sign in.</p>
        ) : setup ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy), then enter the 6-digit code.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Authenticator QR code" className="h-44 w-44 rounded-lg border border-line" />
            <p className="text-xs text-ink-3">Can&apos;t scan? Enter this key: <span className="font-mono font-bold">{setup.secret}</span></p>
            <Field label="6-digit code" error={err2}><input className={inputCls} inputMode="numeric" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setErr2(""); }} /></Field>
            <button
              onClick={async () => { try { await api("/auth/2fa/enable", "POST", { code }); await refresh(); notify("Two-factor authentication is on."); setSetup(null); } catch (x) { setErr2(errText(x)); } }}
              className="rounded-xl bg-leaf px-6 py-3 text-sm font-bold text-white"
            >Turn on</button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-2">Adds a second step at sign-in. Recommended for everyone, required for staff on managed deployments.</p>
            <button onClick={async () => { try { setSetup(await api("/auth/2fa/setup", "POST")); } catch (x) { notify(errText(x), "error"); } }} className="mt-3 rounded-xl border border-line px-5 py-2.5 text-sm font-bold hover:bg-bone">Set up two-factor</button>
          </>
        )}
      </div>
    </Card>
  );
}
