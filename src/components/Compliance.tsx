import { FileText, HeartPulse, Landmark, ShieldCheck, Wallet } from "lucide-react";
import { Reveal } from "./Reveal";

const REQS = [
  {
    icon: FileText,
    title: "Mandatory registration",
    body: "All sports organisations must be registered with the Ministry in accordance with Section 7 of the Sports Act 2013.",
    ref: "Section 7",
  },
  {
    icon: ShieldCheck,
    title: "Name reservation",
    body: "Reserve your organisation's name to ensure uniqueness before you file.",
    ref: "Section 8",
  },
  {
    icon: HeartPulse,
    title: "Constitution & anti-doping",
    body: "Submit your constitution and comply with Anti-Doping regulations.",
    ref: "Section 19",
  },
  {
    icon: Landmark,
    title: "Chapter Six clearance",
    body: "Obtain clearance from relevant government agencies as required under integrity provisions.",
    ref: "Section 23",
  },
  {
    icon: Wallet,
    title: "Registration fees",
    body: "Payment of prescribed fees is mandatory for processing and issuance of your certificate.",
    ref: "Schedule",
  },
];

export function Compliance() {
  return (
    <>
      <section id="sports-act" className="bg-bone py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="eyebrow text-kenya-red">Sports Act 2013</p>
            <h2 className="font-display mt-3 text-2xl font-medium leading-[1.05] tracking-tight sm:text-3xl">
              Compliance, <em className="text-forest-700">made plain.</em>
            </h2>
            <p className="mt-5 max-w-md text-ink-2">
              The platform walks every club and organisation through the legal
              requirements, so registration is complete the first time.
            </p>
            <div className="mt-8 hidden aspect-[4/3] max-w-md overflow-hidden rounded-3xl bg-forest-900 p-8 text-white lg:block">
              <p className="font-display text-5xl font-medium text-gold">
                2013
              </p>
              <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-white/70">
                The Act establishes the framework for sports development,
                registration, integrity and facilities across Kenya.
              </p>
            </div>
          </Reveal>

          <ol className="divide-y divide-line border-y border-line">
            {REQS.map((r, i) => {
              const Icon = r.icon;
              return (
                <Reveal key={r.title} delay={i * 60}>
                  <li className="group flex gap-5 py-7 transition hover:bg-paper/70 sm:px-4">
                    <span className="font-mono pt-1 text-xs text-ink-3">
                      0{i + 1}
                    </span>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-forest-800 text-white transition group-hover:bg-kenya-red">
                      <Icon size={22} strokeWidth={1.6} />
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-lg font-medium">
                          {r.title}
                        </h3>
                        <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-ink-3">
                          {r.ref}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] text-ink-2">{r.body}</p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

    </>
  );
}
