"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Spinner } from "./ui/Spinner";

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  title: string;
  color: string;
}

interface Props {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** When set, a draggable pin shows the chosen location. */
  pick?: { lat: number; lon: number } | null;
  onPick?: (p: { lat: number; lon: number }) => void;
  /** Change `key` to fly the map to a new position. */
  focus?: { lat: number; lon: number; zoom?: number; key: string } | null;
  zoomPosition?: "topleft" | "topright" | "bottomleft" | "bottomright";
  className?: string;
}

const KENYA_BOUNDS: [[number, number], [number, number]] = [
  [-5.3, 33.4],
  [5.6, 42.3],
];

/**
 * Free GIS: OpenStreetMap raster tiles + Leaflet. No API key, no billing.
 * (Fair-use applies to the public tile server; self-host tiles at scale.)
 */
export function GeoMap({
  points,
  selectedId,
  onSelect,
  pick,
  onPick,
  focus,
  zoomPosition = "topleft",
  className = "",
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const pickRef = useRef<Leaflet.Marker | null>(null);
  const cb = useRef({ onSelect, onPick });
  useEffect(() => {
    cb.current = { onSelect, onPick };
  });
  const [ready, setReady] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);

  const zoomPos = useRef(zoomPosition);

  // create map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || mapRef.current) return;
      libRef.current = L;
      const map = L.map(el.current, {
        center: [0.3, 37.9],
        zoom: 6,
        minZoom: 5,
        maxBounds: KENYA_BOUNDS,
        maxBoundsViscosity: 0.8,
        preferCanvas: true,
        zoomControl: false,
        attributionControl: true,
      });
      L.control.zoom({ position: zoomPos.current }).addTo(map);
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      tiles.on("loading", () => setTilesLoading(true));
      tiles.on("load", () => setTilesLoading(false));
      tiles.addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        cb.current.onPick?.({ lat: e.latlng.lat, lon: e.latlng.lng });
      });
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      pickRef.current = null;
    };
  }, []);

  // markers
  useEffect(() => {
    const L = libRef.current;
    const group = layerRef.current;
    if (!ready || !L || !group) return;
    group.clearLayers();
    for (const p of points) {
      const sel = p.id === selectedId;
      const m = L.circleMarker([p.lat, p.lon], {
        radius: sel ? 10 : 6,
        weight: sel ? 3 : 1.5,
        color: sel ? "#ffffff" : "#04170d",
        fillColor: p.color,
        fillOpacity: 0.95,
      });
      m.bindTooltip(p.title, { direction: "top", offset: [0, -6] });
      m.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        cb.current.onSelect?.(p.id);
      });
      m.addTo(group);
      if (sel) m.bringToFront();
    }
  }, [points, selectedId, ready]);

  // pick marker
  useEffect(() => {
    const L = libRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (!pick) {
      pickRef.current?.remove();
      pickRef.current = null;
      return;
    }
    if (!pickRef.current) {
      const icon = L.divIcon({
        className: "",
        iconSize: [28, 38],
        iconAnchor: [14, 36],
        html: `<svg width="28" height="38" viewBox="0 0 28 38"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24 14 38 14 38s14-14 14-24.1C28 6.2 21.7 0 14 0z" fill="#c8102e" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
      });
      const mk = L.marker([pick.lat, pick.lon], { icon, draggable: true }).addTo(map);
      mk.on("dragend", () => {
        const ll = mk.getLatLng();
        cb.current.onPick?.({ lat: ll.lat, lon: ll.lng });
      });
      pickRef.current = mk;
    } else {
      pickRef.current.setLatLng([pick.lat, pick.lon]);
    }
  }, [pick, ready]);

  // programmatic focus
  useEffect(() => {
    if (!ready || !focus || !mapRef.current) return;
    mapRef.current.flyTo([focus.lat, focus.lon], focus.zoom ?? 13, { duration: 0.9 });
  }, [focus?.key, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <div ref={el} className="h-full w-full bg-[#dfe9e3]" />
      {(!ready || tilesLoading) && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-3 rounded-full bg-paper/95 py-2 pl-3 pr-4 shadow-lg">
          <Spinner size={22} />
          <span className="text-xs font-medium text-ink-2">Loading map</span>
        </div>
      )}
    </div>
  );
}
