import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROLES } from "@/lib/roles";
import { Reveal } from "./Reveal";

const FLOW = [
  { t: "Applicant", d: "Submits and pays" },
  { t: "County officer", d: "Reviews locally" },
  { t: "Federation", d: "Endorses membership" },
  { t: "Registrar", d: "Decides & issues certificate" },
  { t: "Integrity", d: "Suspends or reinstates" },
];

export function RunBy() {
  return (
    <section id="run-by" className="bg-paper py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="max-w-2xl">
          <p className="eyebrow text-kenya-red">Who runs it</p>
          <h2 className="font-display mt-3 text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            A public platform, <em className="text-forest-700">run by named offices.</em>
          </h2>
          <p className="mt-4 text-ink-2">
            Every registration passes through people with defined responsibilities. Each office sees only its own
            scope, and every action is written to an audit log.
          </p>
        </Reveal>

        <Reveal className="mt-10">
          <ol className="grid gap-3 md:grid-cols-5">
            {FLOW.map((f, i) => (
              <li key={f.t} className="relative rounded-2xl border border-line bg-bone/70 p-4">
                <span className="font-mono text-[11px] text-ink-3">0{i + 1}</span>
                <p className="font-display mt-1 text-lg font-medium">{f.t}</p>
                <p className="text-sm text-ink-2">{f.d}</p>
                {i < FLOW.length - 1 && <ArrowRight size={16} className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-paper text-ink-3 md:block" />}
              </li>
            ))}
          </ol>
        </Reveal>

        <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r, i) => (
            <Reveal key={r.id} delay={i * 40} className="bg-paper">
              <div className="flex h-full min-h-[210px] flex-col p-6">
                <p className="eyebrow text-[10px] text-forest-700">
                  {r.scope === "national" ? "National" : r.scope === "county" ? "Per county" : "Per federation"}
                </p>
                <h3 className="font-display mt-2 text-lg font-medium leading-snug">{r.label}</h3>
                <p className="mt-1 text-xs text-ink-3">{r.office}</p>
                <p className="mt-3 text-sm text-ink-2">{r.summary}</p>
              </div>
            </Reveal>
          ))}
          <div className="grid place-items-center bg-forest-800 p-6 text-center text-white">
            <p className="font-display text-xl">
              Staff?
              <br />
              <Link href="/login" className="text-gold underline underline-offset-4">Open the console</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
