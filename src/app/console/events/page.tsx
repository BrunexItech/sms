"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { SPORT_BY_ID } from "@/data/sports";
import { errText, useStore } from "@/lib/store";
import { BlockLoader } from "@/components/ui/Spinner";
import { NoAccess, PageTitle } from "@/components/console/ui";

interface Ev { id: string; name: string; sport: string; date: string; venue: string; county: string; organiser: string; level: string }

export default function Page() {
  const { can, notify, refresh } = useStore();
  const [rows, setRows] = useState<Ev[] | null>(null);
  const load = useCallback(async () => {
    try {
      setRows((await api<{ events: Ev[] }>("/events/pending")).events);
    } catch (e) {
      notify(errText(e), "error");
      setRows([]);
    }
  }, [notify]);
  useEffect(() => {
    let cancelled = false;
    api<{ events: Ev[] }>("/events/pending").then((r) => !cancelled && setRows(r.events)).catch(() => !cancelled && setRows([]));
    return () => { cancelled = true; };
  }, []);
  if (!can("applications.review") && !can("applications.decide")) return <NoAccess need="applications.review" />;
  const decide = async (id: string, approve: boolean) => {
    const note = approve ? "" : prompt("Reason for declining this event?") ?? "";
    if (!approve && note.trim().length < 3) return;
    try {
      await api(`/events/${id}/decision`, "POST", { approve, note });
      await Promise.all([load(), refresh()]);
      notify(approve ? "Event approved and listed." : "Event declined.");
    } catch (e) {
      notify(errText(e), "error");
    }
  };
  return (
    <>
      <PageTitle title="Event approvals" sub="Events submitted by verified clubs and organisations appear publicly only after approval." />
      {!rows ? <BlockLoader label="Loading events" /> : rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-ink-3">No events are waiting for approval.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((e) => (
            <li key={e.id} className="rounded-2xl border border-line bg-white p-5">
              <p className="text-lg font-extrabold text-forest-900">{e.name}</p>
              <p className="mt-1 text-sm text-ink-2">{SPORT_BY_ID[e.sport]?.name} · {e.level} · {new Date(e.date).toLocaleDateString("en-KE", { dateStyle: "full" })}</p>
              <p className="text-sm text-ink-3">{e.venue}, {e.county} · by {e.organiser}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => decide(e.id, true)} className="inline-flex items-center gap-2 rounded-lg bg-forest-800 px-4 py-2.5 text-sm font-bold text-white"><Check size={15} /> Approve</button>
                <button onClick={() => decide(e.id, false)} className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2.5 text-sm font-bold text-kenya-red-deep"><X size={15} /> Decline</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
