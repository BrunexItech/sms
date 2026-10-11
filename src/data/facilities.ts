import { KENYA_BOUNDS } from "./kenya-map";

/** Project a lat/lon onto the generated county-map SVG space. */
export function project(lat: number, lon: number): [number, number] {
  const { minLon, maxLat, scale } = KENYA_BOUNDS;
  return [(lon - minLon) * scale, (maxLat - lat) * scale];
}
