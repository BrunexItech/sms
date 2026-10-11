"use client";

import { STAKEHOLDER_TYPES } from "@/lib/types";
import { useStore } from "@/lib/store";
import { inputCls } from "@/components/ui/Field";
import { Card, NoAccess, PageTitle } from "@/components/console/ui";

const FREE_STACK = [
  ["Maps & search", "OpenStreetMap tiles + Nominatim, rendered with Leaflet", "KSh 0"],
  ["Counties, sub-counties, wards", "OCHA COD-AB via HDX, bundled in the app (CC BY-IGO)", "KSh 0"],
  ["Facility base data", "OpenStreetMap contributors via Overpass (ODbL)", "KSh 0"],
  ["Sport photographs", "Wikimedia Commons, openly licensed and credited on /credits, bundled", "KSh 0"],
  ["Hosting", "Existing government or shared server; static front end", "No new cost"],
  ["Database (when backend is added)", "PostgreSQL + PostGIS, self-hosted", "KSh 0"],
  ["Payments", "M-Pesa Daraja API has no integration fee; payers bear standard tariffs", "No platform fee"],
  ["Notifications", "Email via own SMTP; WhatsApp via self-hosted bridge. SMS is the only paid channel and is optional", "Optional"],
];

export default function Page() {
  const { state, can, setFee } = useStore();
  if (!can("settings.manage")) return <NoAccess need="settings.manage" />;

  return (
    <>
      <PageTitle title="Settings" sub="Fee schedule and platform information." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Registration fees (KSh)">
          <ul className="divide-y divide-line">
            {STAKEHOLDER_TYPES.map((t) => (
              <li key={t} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-sm">{t}</span>
                <input
                  aria-label={`Fee for ${t}`}
                  inputMode="numeric"
                  defaultValue={state.fees[t]}
                  onBlur={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, ""));
                    if (v >= 0 && v !== state.fees[t]) setFee(t, v);
                  }}
                  className={`${inputCls} !w-28 !py-2 text-right`}
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">Changes apply to new registrations and are written to the audit log.</p>
        </Card>

        <div className="space-y-5">
          <Card title="Zero-cost stack">
            <ul className="divide-y divide-line text-sm">
              {FREE_STACK.map(([a, b, c]) => (
                <li key={a} className="flex items-start justify-between gap-4 py-2.5">
                  <span><b className="block font-semibold">{a}</b><span className="text-ink-3">{b}</span></span>
                  <span className="shrink-0 rounded-full bg-forest-100 px-2.5 py-1 text-[11px] font-semibold text-forest-800">{c}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
