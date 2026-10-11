"use client";

import { useState } from "react";
import { Crosshair, LocateFixed } from "lucide-react";
import { placeFrom } from "@/lib/admin";
import type { GeoPoint, Place } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Field, inputCls } from "./ui/Field";
import { ButtonSpinner } from "./ui/Spinner";

export function LocationFields({
  place,
  onPlace,
  gps,
  onGps,
  errors = {},
  showGps = true,
}: {
  place: Place;
  onPlace: (p: Place) => void;
  gps?: GeoPoint;
  onGps?: (g: GeoPoint) => void;
  errors?: Partial<Record<"county" | "subCounty" | "ward", string>>;
  showGps?: boolean;
}) {
  const { admin } = useStore();
  const [locating, setLocating] = useState(false);
  const [gpsMsg, setGpsMsg] = useState("");

  const county = admin.counties.find((c) => c.id === place.countyId);
  const sub = county?.s.find((s) => s.id === place.subId);

  const capture = () => {
    if (!navigator.geolocation) return setGpsMsg("GPS is not supported on this device.");
    setLocating(true);
    setGpsMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onGps?.({ lat: p.coords.latitude, lon: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setGpsMsg("Location permission was not granted.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="County" required error={errors.county} className="sm:col-span-2">
        <select
          className={inputCls}
          value={place.countyId}
          onChange={(e) => onPlace(placeFrom(admin, e.target.value))}
        >
          <option value="">Select county (47)</option>
          {admin.counties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.n}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sub-county / Constituency" required error={errors.subCounty}>
        <select
          className={inputCls}
          disabled={!county}
          value={place.subId}
          onChange={(e) => onPlace(placeFrom(admin, place.countyId, e.target.value))}
        >
          <option value="">{county ? `Select (${county.s.length})` : "Select a county first"}</option>
          {county?.s.map((s) => (
            <option key={s.id} value={s.id}>
              {s.n}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ward" required error={errors.ward}>
        <select
          className={inputCls}
          disabled={!sub}
          value={place.wardId}
          onChange={(e) => onPlace(placeFrom(admin, place.countyId, place.subId, e.target.value))}
        >
          <option value="">{sub ? `Select (${sub.w.length})` : "Select a sub-county first"}</option>
          {sub?.w.map((w) => (
            <option key={w.id} value={w.id}>
              {w.n}
            </option>
          ))}
        </select>
      </Field>

      {showGps && (
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-semibold">GPS location</span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={capture}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold transition hover:border-forest-600 disabled:opacity-70"
            >
              {locating ? <ButtonSpinner /> : <LocateFixed size={16} />}
              {locating ? "Locating…" : "Capture my GPS"}
            </button>
            <span className="flex items-center gap-2 text-sm text-ink-2">
              <Crosshair size={15} className="text-ink-3" />
              {gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : "Not captured"}
            </span>
          </div>
          {gpsMsg && <p className="mt-1.5 text-xs font-medium text-kenya-red">{gpsMsg}</p>}
        </div>
      )}
    </div>
  );
}
