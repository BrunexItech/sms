import type { FacilityType } from "@/lib/types";

export interface FacilityGroup {
  id: string;
  label: string;
  color: string;
  types: FacilityType[];
}

/** Legend categories from the Ministry mockup. */
export const FACILITY_GROUPS: FacilityGroup[] = [
  { id: "stadiums", label: "Stadiums", color: "#1f6fd1", types: ["Stadium"] },
  { id: "training", label: "Training Grounds", color: "#d63b3b", types: ["Sports Centre"] },
  { id: "arenas", label: "Indoor Arenas", color: "#f08b00", types: ["Indoor Arena"] },
  { id: "pools", label: "Swimming Pools", color: "#0aa5c9", types: ["Swimming Pool"] },
  { id: "tennis", label: "Tennis Courts", color: "#148a45", types: ["Tennis Court"] },
  { id: "tracks", label: "Athletics Tracks", color: "#d9a21b", types: ["Athletics Track"] },
  {
    id: "community",
    label: "Community Fields",
    color: "#7a3fc4",
    types: ["Football Pitch", "Rugby Ground", "Cricket Ground", "Volleyball Court", "Basketball Court", "Sports Pitch", "Golf Course", "Other"],
  },
  { id: "gyms", label: "Gyms & Fitness Centres", color: "#6b4a3a", types: ["Gym / Fitness Centre"] },
];

const BY_TYPE: Record<string, FacilityGroup> = {};
for (const g of FACILITY_GROUPS) for (const t of g.types) BY_TYPE[t] = g;

export function groupOf(type: string): FacilityGroup {
  return BY_TYPE[type] ?? FACILITY_GROUPS[6];
}
