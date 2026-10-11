"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Field, inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", email: "", topic: "Registration", message: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(f.email) || f.message.trim().length < 10)
      return setErr("Please add your name, a valid email and a message of at least a sentence.");
    setErr("");
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setSent(true);
    }, 1200);
  };

  if (sent)
    return (
      <div className="step-anim grid place-items-center py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-leaf-soft text-leaf"><CheckCircle2 size={30} /></span>
        <h3 className="mt-4 text-xl font-extrabold text-forest-900">Message received</h3>
        <p className="mt-1 max-w-sm text-sm text-ink-2">Thank you. The Ministry will respond to {f.email}. Prototype: nothing was actually sent.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Your name" required><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Email" required><input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Topic" className="sm:col-span-2">
        <select className={inputCls} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
          {["Registration", "Payments", "Facilities", "Events", "Technical support", "Other"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Message" required className="sm:col-span-2" error={err}>
        <textarea className={`${inputCls} min-h-[130px] resize-y`} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      </Field>
      <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-forest-800 to-forest-900 px-7 py-3.5 text-sm font-bold text-white sm:col-span-2 sm:justify-self-start">
        {busy ? <ButtonSpinner /> : <Send size={16} />} {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
