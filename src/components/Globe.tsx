"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { CountryData } from "@/lib/aggregation";
import { ISO_NUM_A2 } from "@/lib/iso-numeric";
import { getCountryName } from "@/lib/aggregation";

const GLOBE_IMAGE = "https://unpkg.com/three-globe/example/img/earth-dark.jpg";
const BUMP_IMAGE = "https://unpkg.com/three-globe/example/img/earth-topology.png";

interface Props {
  countryData: CountryData[];
  onCountryClick: (country: CountryData) => void;
  onCountryHover?: (country: CountryData | null) => void;
}

interface GeoFeature {
  type: string;
  id: number | string;
  properties: Record<string, unknown>;
  geometry: unknown;
}

export default function GlobeComponent({ countryData, onCountryClick, onCountryHover }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 600 });
  const [geoJson, setGeoJson] = useState<{ features: GeoFeature[] } | null>(null);

  // Build lookup map: country code -> data
  const countryMap = useMemo(() => {
    const map = new Map<string, CountryData>();
    for (const c of countryData) {
      map.set(c.countryCode, c);
    }
    return map;
  }, [countryData]);

  // Compute max artist count for color scaling
  const maxArtists = useMemo(() => {
    return Math.max(1, ...countryData.map((c) => c.artistCount));
  }, [countryData]);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load GeoJSON
  useEffect(() => {
    fetch(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"
    )
      .then((res) => res.json())
      .then((topoJson) => {
        // Convert TopoJSON to GeoJSON
        import("topojson-client").then(({ feature }) => {
          const geo = feature(
            topoJson,
            topoJson.objects.countries
          ) as unknown as { features: GeoFeature[] };
          setGeoJson(geo);
        });
      })
      .catch((err) => console.error("Failed to load world data:", err));
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (globeRef.current?.controls) {
      const controls = globeRef.current.controls() as { autoRotate: boolean; autoRotateSpeed: number };
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
    }
  }, [geoJson]);

  const getCC = useCallback((feat: object): string | null => {
    const rawId = (feat as GeoFeature).id;
    const numId = typeof rawId === "string" ? parseInt(rawId, 10) : rawId;
    return ISO_NUM_A2[numId] ?? null;
  }, []);

  // Country fill color: dim teal → Spotify green → bright lime based on artist intensity
  const getPolygonColor = useCallback((feat: object) => {
    const cc = getCC(feat);
    const data = cc ? countryMap.get(cc) : undefined;
    if (!data) return "rgba(25, 28, 48, 0.55)";

    const intensity = Math.log(data.artistCount + 1) / Math.log(maxArtists + 1);
    let r, g, b, a;
    if (intensity < 0.5) {
      const t = intensity * 2;
      r = Math.round(0 + t * 29);
      g = Math.round(140 + t * 45);
      b = Math.round(70 + t * 14);
      a = 0.35 + t * 0.35;
    } else {
      const t = (intensity - 0.5) * 2;
      r = Math.round(29 + t * 80);
      g = Math.round(185 + t * 55);
      b = Math.round(84 + t * 50);
      a = 0.7 + t * 0.25;
    }
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }, [countryMap, maxArtists, getCC]);

  // Height proportional to listening intensity — top countries "pop out"
  const getPolygonAltitude = useCallback((feat: object) => {
    const cc = getCC(feat);
    const data = cc ? countryMap.get(cc) : undefined;
    if (!data) return 0.005;
    const intensity = Math.log(data.artistCount + 1) / Math.log(maxArtists + 1);
    return 0.005 + intensity * 0.06;
  }, [countryMap, maxArtists, getCC]);

  const getPolygonStrokeColor = useCallback((feat: object) => {
    const cc = getCC(feat);
    return cc && countryMap.has(cc)
      ? "rgba(29, 185, 84, 0.7)"
      : "rgba(60, 65, 100, 0.3)";
  }, [countryMap, getCC]);

  const handlePolygonClick = useCallback((feat: object) => {
    const cc = getCC(feat);
    if (cc) {
      const data = countryMap.get(cc);
      if (data) onCountryClick(data);
    }
  }, [countryMap, getCC, onCountryClick]);

  const handlePolygonHover = useCallback((feat: object | null) => {
    if (!feat) {
      onCountryHover?.(null);
      return;
    }
    const cc = getCC(feat);
    const data = cc ? countryMap.get(cc) : undefined;
    onCountryHover?.(data ?? null);
  }, [countryMap, getCC, onCountryHover]);

  const getPolygonLabel = useCallback((feat: object) => {
    const cc = getCC(feat);
    const name = cc ? getCountryName(cc) : "";
    const data = cc ? countryMap.get(cc) : undefined;
    if (!data) {
      if (!name) return "";
      return `<div class="globe-tooltip"><span class="tooltip-name">${name}</span></div>`;
    }
    return `
      <div class="globe-tooltip">
        <div class="tooltip-name">${data.countryName}</div>
        <div class="tooltip-stats">${data.artistCount} artist${data.artistCount !== 1 ? "s" : ""} &middot; ${data.trackCount} track${data.trackCount !== 1 ? "s" : ""}</div>
      </div>
    `;
  }, [countryMap, getCC]);

  if (!geoJson) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl={GLOBE_IMAGE}
        bumpImageUrl={BUMP_IMAGE}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="rgba(29,185,84,0.8)"
        atmosphereAltitude={0.2}
        polygonsData={geoJson.features}
        polygonAltitude={getPolygonAltitude}
        polygonCapColor={getPolygonColor}
        polygonSideColor={() => "rgba(0, 20, 10, 0.3)"}
        polygonStrokeColor={getPolygonStrokeColor}
        polygonLabel={getPolygonLabel}
        onPolygonClick={handlePolygonClick}
        onPolygonHover={handlePolygonHover}
        polygonsTransitionDuration={250}
      />
    </div>
  );
}
