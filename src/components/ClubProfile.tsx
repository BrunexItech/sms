"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, MapPin, ShieldCheck, UserCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { SPORT_BY_ID } from "@/data/sports";
import { errText } from "@/lib/store";
import { BlockLoader } from "./ui/Spinner";

interface Profile {
  club: { id: string; name: string; type: string; sport: string; level: string; federation: string; county: string; subCounty: string; ward: string; certificateNo: string | null };
  officials: { role: string; name: string }[];
  players: { name: string; role: string; sport: string }[];
}

export function ClubProfile({ id }: { id: string }) {
  const [data, setData] = useState<Profile | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Profile>(`/clubs/${encodeURIComponent(id)}`).then(setData).catch((e) => setErr(errText(e)));
  }, [id]);

  return (
    <div className="mx-auto max-w-[1100px] px-5">
      <Link href="/clubs" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-forest-700 hover:underline"><ArrowLeft size={15} /> All clubs</Link>
      {err ? (
        <p role="alert" className="rounded-xl bg-white p-6 font-semibold text-kenya-red-deep">{err}</p>
      ) : !data ? (
        <BlockLoader label="Loading the club" />
      ) : (
        <div className="grid gap-5">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-[0_30px_60px_-45px_rgba(6,45,87,0.5)]">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-leaf"><BadgeCheck size={15} /> Verified · {data.club.type}</p>
            <h2 className="mt-1 text-2xl font-bold text-forest-900">{data.club.name}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-ink-3">Sport</dt><dd className="font-semibold">{SPORT_BY_ID[data.club.sport]?.name ?? data.club.sport}</dd></div>
              {data.club.level && <div><dt className="text-ink-3">Level</dt><dd className="font-semibold">{data.club.level}</dd></div>}
              <div><dt className="text-ink-3">Federation</dt><dd className="font-semibold"><Link className="hover:underline" href={`/federations/${encodeURIComponent(data.club.sport)}`}>{data.club.federation || "—"}</Link></dd></div>
              <div><dt className="text-ink-3">Certificate</dt><dd className="font-mono text-xs font-semibold">{data.club.certificateNo ? <Link className="hover:underline" href={`/verify?no=${encodeURIComponent(data.club.certificateNo)}`}>{data.club.certificateNo}</Link> : "—"}</dd></div>
            </dl>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-2"><MapPin size={15} /> {[data.club.ward, data.club.subCounty, data.club.county].filter(Boolean).join(", ")}</p>
          </section>

          {data.officials.length > 0 && (
            <section className="rounded-2xl border border-line bg-white p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold text-forest-900"><UserCheck size={20} /> Club leadership</h3>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.officials.map((o, i) => (
                  <li key={i} className="rounded-lg border border-line px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-3">{o.role}</p>
                    <p className="font-semibold">{o.name}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-white p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-forest-900"><Users size={20} /> Registered players</h3>
            {data.players.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">No players are listed publicly yet.</p>
            ) : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.players.map((p, i) => (
                  <li key={i} className="rounded-lg border border-line px-4 py-3">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-ink-3">{p.role} · {SPORT_BY_ID[p.sport]?.name ?? p.sport}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-3"><ShieldCheck size={14} /> Only verified players who agreed to be listed (or whose guardian agreed) appear here.</p>
          </section>
        </div>
      )}
    </div>
  );
}
