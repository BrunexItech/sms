"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { Download, FileText, Wallet } from "lucide-react";
import { AssistantPanel } from "./ChatWidget";
import { FacilityMapPanel } from "./FacilityMapPanel";
import { RegistrationFlow } from "./RegistrationFlow";
import { SportsStrip } from "./SportsStrip";
import { StatsBand } from "./StatsBand";
import { BlockLoader } from "./ui/Spinner";
import { useStore } from "@/lib/store";
import { SPORT_BY_ID } from "@/data/sports";

/**
 * The working part of the home page, laid out as in the Ministry mockup:
 * sports strip, totals band, then Register Now | Facilities Map | Act, Fees and Assistant.
 */
export function HomeDashboard() {
  const [sport, setSport] = useState<string | null>(null);
  const { state } = useStore();
  const individual = state.fees["Player / Sportsperson"];
  const club = state.fees.Club;

  return (
    <>
      <SportsStrip value={sport} onChange={setSport} />
      <StatsBand />

      <div className="mx-auto max-w-[1500px] px-3 pb-12 pt-5 sm:px-5">
        {sport && (
          <p className="step-anim mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-forest-100 px-4 py-2.5 text-sm text-forest-900">
            <b>{SPORT_BY_ID[sport]?.name}</b> selected: the map shows only its facilities and registration is preset to it.
            <button onClick={() => setSport(null)} className="font-bold underline underline-offset-4">Clear</button>
          </p>
        )}
        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(340px,0.95fr)_minmax(0,1.7fr)_minmax(300px,0.85fr)]">
          <div id="register" className="scroll-mt-28">
            <Suspense fallback={<BlockLoader label="Preparing registration" />}>
              <RegistrationFlow compact presetSport={sport} />
            </Suspense>
          </div>

          <div id="facilities" className="scroll-mt-28">
            <FacilityMapPanel sportId={sport} />
          </div>

          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border border-line bg-white p-4 shadow-[0_18px_40px_-28px_rgba(6,45,87,0.5)]">
              <div className="flex gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-forest-100 text-forest-800"><FileText size={26} strokeWidth={1.6} /></span>
                <div>
                  <h2 className="text-base font-bold text-forest-900">Kenya Sports Act</h2>
                  <p className="mt-0.5 text-[13px] text-ink-3">Access the Sports Act and relevant regulations.</p>
                </div>
              </div>
              <Link href="/sports-act" className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-forest-800 to-forest-900 py-2.5 text-sm font-bold text-white transition hover:brightness-110">
                <Download size={16} /> View Sports Act
              </Link>
            </section>

            <section className="rounded-2xl border border-line bg-white p-4 shadow-[0_18px_40px_-28px_rgba(6,45,87,0.5)]">
              <div className="flex gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-forest-100 text-forest-800"><Wallet size={26} strokeWidth={1.6} /></span>
                <h2 className="self-center text-base font-bold text-forest-900">Registration Fees</h2>
              </div>
              <dl className="mt-3 divide-y divide-line text-sm">
                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-ink-2">Individual Registration</dt>
                  <dd className="text-lg font-bold text-forest-900">KSh {individual.toLocaleString()}</dd>
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-ink-2">Club Registration</dt>
                  <dd className="text-lg font-bold text-forest-900">KSh {club.toLocaleString()}</dd>
                </div>
              </dl>
              <Link href="/payments" className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-leaf py-3 text-sm font-bold text-white shadow-[0_12px_22px_-12px_rgba(20,138,69,0.9)] transition hover:brightness-110">
                Pay Now
              </Link>
            </section>

            <AssistantPanel />
          </div>
        </div>
      </div>
    </>
  );
}
