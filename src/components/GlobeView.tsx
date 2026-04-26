"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { CountryData } from "@/lib/aggregation";
import CountryPanel from "@/components/CountryPanel";
import { COUNTRY_LANGUAGE } from "@/lib/iso-numeric";

interface TopItemsResponse {
  artists: {
    id: string;
    name: string;
    genres: string[];
    imageUrl: string | null;
    spotifyUrl: string;
  }[];
  tracks: {
    id: string;
    artistIds: string[];
  }[];
}

export default function GlobeView() {
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<CountryData | null>(null);
  const [progress, setProgress] = useState("");
  const [timeRange, setTimeRange] = useState<string>("medium_term");
  const [vizMode, setVizMode] = useState<"globe" | "graph">("globe");

  const loadData = useCallback(async () => {
    setLoading(true);
    setResolving(false);
    setError(null);
    setCountryData([]);
    setProgress("Fetching your top artists and tracks...");

    try {
      // Step 1: Get top items from Spotify (already deduplicated server-side)
      console.log("[GlobeView] Step 1: Fetching top items...");
      const topRes = await fetch(`/api/spotify/top-items?time_range=${timeRange}`);
      if (!topRes.ok) {
        const body = await topRes.text().catch(() => "");
        throw new Error(`Failed to fetch Spotify data (${topRes.status}): ${body}`);
      }
      const topData: TopItemsResponse = await topRes.json();
      console.log("[GlobeView] Step 1 done:", topData.artists.length, "artists,", topData.tracks.length, "tracks");

      // Build lookup maps from the pre-processed data
      const artistById = new Map(
        topData.artists.map((a) => [a.id, a])
      );

      // Track which tracks belong to which artist
      const tracksByArtist = new Map<string, Set<string>>();
      for (const track of topData.tracks) {
        for (const artistId of track.artistIds) {
          if (!tracksByArtist.has(artistId)) tracksByArtist.set(artistId, new Set());
          tracksByArtist.get(artistId)!.add(track.id);
        }
      }

      setProgress(`Found ${topData.artists.length} artists. Resolving countries...`);
      // Running artistId → countryCode map, updated as stream arrives
      const artistCountryMap = new Map<string, string | null>();

      const { getCountryName } = await import("@/lib/aggregation");

      // Rebuild CountryData from current artistCountryMap snapshot
      const buildCountryData = (): CountryData[] => {
        const countryMap = new Map<
          string,
          {
            artists: Map<string, { id: string; name: string; imageUrl: string | null; genres: string[]; spotifyUrl: string }>;
            tracks: Set<string>;
            genres: Set<string>;
          }
        >();

        for (const [artistId, cc] of artistCountryMap) {
          const effectiveCc = cc || "XX";
          const artist = artistById.get(artistId);
          if (!artist) continue;
          if (!countryMap.has(effectiveCc)) {
            countryMap.set(effectiveCc, { artists: new Map(), tracks: new Set(), genres: new Set() });
          }
          const entry = countryMap.get(effectiveCc)!;
          entry.artists.set(artistId, artist);
          artist.genres.forEach((g) => entry.genres.add(g));
          const artistTracks = tracksByArtist.get(artistId);
          if (artistTracks) {
            for (const tid of artistTracks) entry.tracks.add(tid);
          }
        }

        const result: CountryData[] = [];
        for (const [cc, data] of countryMap) {
          result.push({
            countryCode: cc,
            countryName: cc === "XX" ? "Unknown Region" : getCountryName(cc),
            artistCount: data.artists.size,
            trackCount: data.tracks.size,
            trackIds: Array.from(data.tracks),
            topArtists: Array.from(data.artists.values()),
            genres: Array.from(data.genres).slice(0, 10),
            languages: COUNTRY_LANGUAGE[cc] || [],
          });
        }
        result.sort((a, b) => b.artistCount - a.artistCount);
        return result;
      };

      // Step 2: Stream artist country resolution with timeout
      console.log("[GlobeView] Step 2: Posting to /api/artists/countries...");
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.warn("[GlobeView] Stream timeout after 60s — aborting");
        controller.abort();
      }, 60000);

      let countriesRes: Response;
      try {
        countriesRes = await fetch("/api/artists/countries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artists: topData.artists.map((a) => ({
              id: a.id,
              name: a.name,
              genres: a.genres,
              imageUrl: a.imageUrl,
            })),
          }),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        console.error("[GlobeView] Countries fetch failed:", fetchErr);
        throw new Error("Country resolution request failed");
      }

      console.log("[GlobeView] Countries response status:", countriesRes.status);

      if (!countriesRes.ok || !countriesRes.body) {
        clearTimeout(timeout);
        throw new Error("Failed to resolve countries");
      }

      const reader = countriesRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalResolved = 0;
      let firstDataShown = false;
      let updateTimeout: ReturnType<typeof setTimeout> | null = null;

      // Flush accumulated changes to React state, transition from spinner to globe
      const flushUpdate = () => {
        if (updateTimeout) {
          clearTimeout(updateTimeout);
          updateTimeout = null;
        }
        const data = buildCountryData();
        console.log("[GlobeView] Flushing update:", data.length, "countries,", totalResolved, "artists resolved");
        setCountryData(data);
        if (!firstDataShown) {
          firstDataShown = true;
          setLoading(false);
          // If the batch resolved all artists at once (cached), skip "resolving" state
          if (totalResolved >= topData.artists.length) {
            setResolving(false);
          } else {
            setResolving(true);
          }
        }
      };

      // Batch rapid updates so we don't re-render on every single artist
      const scheduleUpdate = () => {
        if (!updateTimeout) {
          updateTimeout = setTimeout(flushUpdate, 250);
        }
      };

      // Stream reading loop
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let msg: Record<string, unknown>;
            try {
              msg = JSON.parse(line) as Record<string, unknown>;
            } catch {
              continue;
            }

            const msgType = msg.type as string;
            if (msgType === "error") {
              console.error("[GlobeView] Stream error from server:", msg.message);
              break;
            } else if (msgType === "batch") {
              const artists = msg.artists as Array<{ id: string; countryCode: string | null; name: string; genres?: string[] }>;
              if (Array.isArray(artists)) {
                for (const a of artists) {
                  artistCountryMap.set(a.id, a.countryCode);
                  // Merge MB genres into artist data when Spotify genres are empty
                  if (a.genres?.length) {
                    const existing = artistById.get(a.id);
                    if (existing && existing.genres.length === 0) {
                      existing.genres = a.genres;
                    }
                  }
                  totalResolved++;
                }
                console.log("[GlobeView] Batch received:", artists.length, "artists, total:", totalResolved);
                scheduleUpdate();
              }
            } else if (msgType === "artist" && typeof msg.id === "string") {
              artistCountryMap.set(msg.id, (msg.countryCode as string | null) ?? null);
              // Merge MB genres into artist data when Spotify genres are empty
              const mbGenres = msg.genres as string[] | undefined;
              if (mbGenres?.length) {
                const existing = artistById.get(msg.id as string);
                if (existing && existing.genres.length === 0) {
                  existing.genres = mbGenres;
                }
              }
              totalResolved++;
              setProgress(`Resolved ${totalResolved} / ${topData.artists.length} artists...`);
              scheduleUpdate();
            } else if (msgType === "done") {
              console.log("[GlobeView] Stream done message received");
              flushUpdate();
            }
          }
        }
      } catch (streamErr) {
        console.error("[GlobeView] Stream reading error:", streamErr);
      } finally {
        clearTimeout(timeout);
      }

      // Final flush after stream ends
      console.log("[GlobeView] Stream ended, final flush. Total resolved:", totalResolved);
      flushUpdate();
    } catch (err) {
      console.error("[GlobeView] loadData error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setResolving(false);
      setProgress("");
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 py-4 flex-wrap">
        {/* Time range */}
        <div className="flex items-center gap-2">
          {[
            { value: "short_term", label: "Last 4 Weeks" },
            { value: "medium_term", label: "Last 6 Months" },
            { value: "long_term", label: "All Time" },
          ].map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-4 py-2 text-sm rounded-full transition-colors ${
                timeRange === range.value
                  ? "bg-accent text-black font-semibold"
                  : "bg-surface border border-border text-muted hover:text-foreground"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Viz toggle */}
        <div className="flex items-center bg-surface border border-border rounded-full p-0.5">
          <button
            onClick={() => setVizMode("globe")}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              vizMode === "globe"
                ? "bg-accent text-black font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            🌍 Globe
          </button>
          <button
            onClick={() => setVizMode("graph")}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              vizMode === "graph"
                ? "bg-accent text-black font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            🕸️ Graph
          </button>
        </div>
      </div>

      {/* Loading / Error / Visualization */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin" />
          <p className="text-muted text-sm animate-pulse">{progress}</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-danger text-sm">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm hover:bg-surface-elevated transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Visualization — left */}
          <div className="flex-1 min-h-[400px] min-w-0 relative">
            {resolving && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-surface/80 backdrop-blur-sm rounded-full px-3 py-1 pointer-events-none">
                <div className="w-3 h-3 border-2 border-border border-t-accent rounded-full animate-spin" />
                <span className="text-muted text-xs">{progress}</span>
              </div>
            )}
            {vizMode === "globe" ? (
              <GlobeRenderer
                countryData={countryData}
                onCountryClick={(c) => {
                  setSelectedCountry(c);
                  setHoveredCountry(null);
                }}
                onCountryHover={setHoveredCountry}
              />
            ) : (
              <GraphRenderer countryData={countryData} />
            )}
          </div>

          {/* Country Panel — right sidebar */}
          <div className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-border overflow-y-auto">
            <CountryPanel
              countryData={countryData}
              activeCountry={selectedCountry}
              onSelectCountry={setSelectedCountry}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Globe Renderer (lazy-loaded to avoid SSR issues with Three.js) ----

function GlobeRenderer({
  countryData,
  onCountryClick,
  onCountryHover,
}: {
  countryData: CountryData[];
  onCountryClick: (country: CountryData) => void;
  onCountryHover: (country: CountryData | null) => void;
}) {
  const [GlobeComponent, setGlobeComponent] = useState<React.ComponentType<{
    countryData: CountryData[];
    onCountryClick: (country: CountryData) => void;
    onCountryHover?: (country: CountryData | null) => void;
  }> | null>(null);

  useEffect(() => {
    import("@/components/Globe").then((mod) => setGlobeComponent(() => mod.default));
  }, []);

  if (!GlobeComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <GlobeComponent
      countryData={countryData}
      onCountryClick={onCountryClick}
      onCountryHover={onCountryHover}
    />
  );
}

// ---- Graph Renderer (lazy-loaded) ----

function GraphRenderer({ countryData }: { countryData: CountryData[] }) {
  const [GraphComponent, setGraphComponent] = useState<React.ComponentType<{ countryData: CountryData[] }> | null>(null);

  useEffect(() => {
    import("@/components/GraphView").then((mod) => setGraphComponent(() => mod.default));
  }, []);

  if (!GraphComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return <GraphComponent countryData={countryData} />;
}
