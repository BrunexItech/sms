import type { Place } from "./types";

export interface AdminWard {
  id: string;
  n: string;
  la: number;
  lo: number;
}
export interface AdminSub {
  id: string;
  n: string;
  la: number;
  lo: number;
  w: AdminWard[];
}
export interface AdminCounty {
  id: string;
  n: string;
  la: number;
  lo: number;
  s: AdminSub[];
}
export interface AdminData {
  source: string;
  generated: string;
  counties: AdminCounty[];
}

/** Lower-case letters only, so "Murang'a", "Elgeyo/Marakwet" and "Elegeyo-Marakwet" compare equal. */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

export function emptyPlace(): Place {
  return { countyId: "", subId: "", wardId: "", county: "", subCounty: "", ward: "" };
}

export function placeFrom(
  admin: AdminData,
  countyId: string,
  subId?: string | null,
  wardId?: string | null,
): Place {
  const c = admin.counties.find((x) => x.id === countyId);
  const s = c?.s.find((x) => x.id === subId);
  const w = s?.w.find((x) => x.id === wardId);
  return {
    countyId: c?.id ?? "",
    subId: s?.id ?? "",
    wardId: w?.id ?? "",
    county: c?.n ?? "",
    subCounty: s?.n ?? "",
    ward: w?.n ?? "",
  };
}

export function formatPlace(p: Place): string {
  return [p.ward, p.subCounty, p.county].filter(Boolean).join(", ") || "—";
}

let adminPromise: Promise<AdminData> | null = null;
export function loadAdmin(): Promise<AdminData> {
  adminPromise ??= fetch("/data/kenya-admin.json").then((r) => {
    if (!r.ok) throw new Error("Could not load administrative boundaries");
    return r.json();
  });
  return adminPromise;
}

/** Nearest ward centroid to a point. Good enough to pre-fill the cascade from a map pin. */
export function nearestPlace(admin: AdminData, lat: number, lon: number): Place {
  let best: { d: number; c: AdminCounty; s: AdminSub; w: AdminWard } | null = null;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const c of admin.counties)
    for (const s of c.s)
      for (const w of s.w) {
        const d = (w.la - lat) ** 2 + ((w.lo - lon) * k) ** 2;
        if (!best || d < best.d) best = { d, c, s, w };
      }
  return best ? placeFrom(admin, best.c.id, best.s.id, best.w.id) : emptyPlace();
}
