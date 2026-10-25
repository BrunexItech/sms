"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Building2, Landmark, Mail, MapPin, Plus, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import { SPORT_BY_ID } from "@/data/sports";
import { errText } from "@/lib/store";
import { Pill } from "./ui/Pill";
import { BlockLoader } from "./ui/Spinner";

interface Official { role: string; name: string }
interface Body { id: string; name: string; county: string; subCounty: string; ward: string; address?: string; officials: Official[] }
interface Data {
  federation: { sportId: string; sportName: string; name: string; status: string; contactEmail: string };
  national: Body | null;
  branches: Body[];
  clubs: number;
}

function Officials({ list }: { list: Official[] }) {
  if (!list.length) return null;
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-3">
      {list.map((o, i) => (
        <li key={i} className="rounded-lg bg-bone px-3 py-2">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">{o.role}</p>
          <p className="text-sm font-semibold">{o.name}</p>
        </li>
      ))}
    </ul>
  );
}

export function FederationProfile({ sport }: { sport: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Data>(`/federations/${encodeURIComponent(sport)}`).then(setData).catch((e) => setErr(errText(e)));
  }, [sport]);

  return (
    <div className="mx-auto max-w-[1100px] px-5">
      <Link href="/federations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-forest-700 hover:underline"><ArrowLeft size={15} /> All federations</Link>
      {err ? (
        <p role="alert" className="rounded-xl bg-white p-6 font-semibold text-kenya-red-deep">{err}</p>
      ) : !data ? (
        <BlockLoader label="Loading the federation" />
      ) : (
        <div className="grid gap-5">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_30px_60px_-45px_rgba(6,45,87,0.5)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-leaf"><Landmark size={15} /> {SPORT_BY_ID[sport]?.name ?? data.federation.sportName}</p>
                <h2 className="mt-1 text-2xl font-bold text-forest-900">{data.federation.name.split(";")[0].trim()}</h2>
              </div>
              <Pill>{data.national ? "Verified" : data.federation.status}</Pill>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              {data.federation.contactEmail && <a className="inline-flex items-center gap-1.5 text-forest-700 hover:underline" href={`mailto:${data.federation.contactEmail}`}><Mail size={14} /> {data.federation.contactEmail}</a>}
              <Link className="font-semibold text-forest-700 hover:underline" href={`/clubs?sport=${encodeURIComponent(sport)}`}>{data.clubs} verified club{data.clubs === 1 ? "" : "s"}</Link>
              {data.national && (data.national.address || data.national.county) && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> Head office: {[data.national.address, data.national.county].filter(Boolean).join(", ")}</span>}
            </div>
            {data.national ? (
              <>
                <h3 className="mt-5 flex items-center gap-2 text-sm font-bold text-forest-900"><UserCheck size={16} /> National leadership</h3>
                <Officials list={data.national.officials} />
              </>
            ) : (
              <p className="mt-4 rounded-lg bg-gold-soft px-4 py-3 text-sm text-forest-900">
                The national body of this sport has not registered on the platform yet. The Ministry lists the governing body above in the meantime.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {!data.national && <Link href={`/register?as=federation&sport=${encodeURIComponent(sport)}`} className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-5 py-2.5 text-sm font-bold text-white"><Plus size={15} /> Register this federation</Link>}
              {data.national && <Link href={`/register?as=branch&sport=${encodeURIComponent(sport)}`} className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-5 py-2.5 text-sm font-bold text-white"><Plus size={15} /> Register a county branch</Link>}
              <Link href={`/register?as=club&sport=${encodeURIComponent(sport)}`} className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-2.5 text-sm font-bold text-ink-2 hover:bg-bone">Register a club</Link>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-forest-900"><Building2 size={20} /> County branches <span className="text-base font-semibold text-ink-3">({data.branches.length})</span></h3>
            {data.branches.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">{data.national ? "No county branch has been verified yet." : "County branches register once the national federation is verified."}</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {data.branches.map((b) => (
                  <li key={b.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 font-bold text-forest-900"><BadgeCheck size={16} className="text-leaf" /> {b.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3"><MapPin size={13} /> {[b.address, b.ward, b.subCounty, b.county].filter(Boolean).join(", ")}</p>
                      </div>
                      <span className="rounded-full bg-forest-100 px-3 py-1 text-xs font-bold text-forest-800">{b.county} County</span>
                    </div>
                    <Officials list={b.officials} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
