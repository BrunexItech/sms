"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Smartphone } from "lucide-react";
import { errText, useStore } from "@/lib/store";
import { DEMO_OTP } from "./RegistrationFlow";
import { inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";

/**
 * Pays one or more registrations. With M-Pesa configured it sends an STK push and waits for the result;
 * otherwise (development only) it uses the demo one-time password.
 */
export function PayBox({
  ids,
  amount,
  defaultPhone = "",
  label,
  club = false,
  onDone,
}: {
  ids: string[];
  amount: number;
  defaultPhone?: string;
  label?: string;
  club?: boolean;
  onDone?: () => void;
}) {
  const { state, payApplication, payClub, startMpesa, attemptStatus } = useStore();
  const mpesa = state.config.mpesa;
  const [phone, setPhone] = useState(defaultPhone);
  const [method, setMethod] = useState("M-Pesa");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "waiting" | "done">("idle");
  const attempt = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const poll = async (id: string, tries = 0) => {
    if (!alive.current) return;
    try {
      const r = await attemptStatus(id);
      if (!alive.current) return;
      if (r.status === "Success") {
        setPhase("done");
        onDone?.();
      } else if (r.status !== "Pending") {
        setPhase("idle");
        setErr(r.message || "The payment was not completed.");
      } else if (tries > 70) {
        setPhase("idle");
        setErr("We have not received confirmation yet. If money was deducted it will appear in My account shortly.");
      } else {
        setTimeout(() => poll(id, tries + 1), 3000);
      }
    } catch (e) {
      setPhase("idle");
      setErr(errText(e));
    }
  };

  const go = async () => {
    setErr("");
    if (mpesa) {
      if (!/^(\+?254|0)?[17]\d{8}$/.test(phone.replace(/\s/g, ""))) return setErr("Enter the Safaricom number that will receive the M-Pesa prompt.");
      setPhase("sending");
      try {
        attempt.current = await startMpesa(ids, phone);
        setPhase("waiting");
        poll(attempt.current);
      } catch (e) {
        setPhase("idle");
        setErr(errText(e));
      }
      return;
    }
    if (otp.length !== 6) return setErr("Enter the 6-digit one-time password.");
    setPhase("sending");
    try {
      if (club) await payClub(ids, method, phone, otp);
      else await payApplication(ids[0], method, phone, otp);
      setPhase("done");
      onDone?.();
    } catch (e) {
      setPhase("idle");
      setErr(errText(e));
    }
  };

  if (phase === "done")
    return <p className="mt-3 flex items-center gap-2 rounded-lg bg-leaf-soft px-3.5 py-2.5 text-sm font-bold text-leaf"><Check size={16} /> Payment received.</p>;

  return (
    <div className="mt-3 rounded-xl border border-line bg-bone p-3.5">
      {phase === "waiting" ? (
        <div className="flex items-start gap-3 text-sm">
          <ButtonSpinner className="mt-0.5 text-forest-700" />
          <div>
            <p className="font-bold text-forest-900">Check your phone</p>
            <p className="text-ink-2">Enter your M-Pesa PIN to pay KSh {amount.toLocaleString()}. This page updates when payment is confirmed.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {mpesa ? (
              <input className={`${inputCls} sm:col-span-2`} inputMode="tel" placeholder="M-Pesa phone, e.g. 0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="M-Pesa phone number" />
            ) : (
              <>
                <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
                  {["M-Pesa", "Visa / Mastercard", "Mobile Money", "Bank transfer"].map((m) => <option key={m}>{m}</option>)}
                </select>
                <input className={inputCls} placeholder="Phone / reference" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <input className={inputCls} inputMode="numeric" maxLength={6} placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
              </>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <Smartphone size={12} />
            {mpesa ? "You will receive an M-Pesa prompt on this number." : <>Demo mode: no money moves. OTP is <b className="font-mono">{DEMO_OTP}</b>.</>}
          </p>
        </>
      )}
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-kenya-red">{err}</p>}
      {phase !== "waiting" && (
        <button onClick={go} disabled={phase === "sending"} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-leaf px-4 py-2.5 text-sm font-bold text-white disabled:opacity-80">
          {phase === "sending" ? <ButtonSpinner /> : <Check size={16} />} {label ?? `Pay KSh ${amount.toLocaleString()}`}
        </button>
      )}
    </div>
  );
}
