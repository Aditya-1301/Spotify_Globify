"use client";

import Image from "next/image";
import { useState } from "react";
import type { CountryData } from "@/lib/aggregation";
import { getCountryFlag, COUNTRY_LANGUAGE } from "@/lib/iso-numeric";

interface Props {
  countryData: CountryData[];
  /** The country to display — null shows the overview */
  activeCountry: CountryData | null;
  onSelectCountry: (country: CountryData | null) => void;
}

export default function CountryPanel({ countryData, activeCountry, onSelectCountry }: Props) {
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [playlistFor, setPlaylistFor] = useState<string | null>(null);

  const handleCreatePlaylist = async (country: CountryData) => {
    setCreatingFor(country.countryCode);
    setPlaylistUrl(null);
    setPlaylistFor(null);
    try {
      const res = await fetch("/api/playlists/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: country.countryCode,
          countryName: country.countryName,
          seedArtistIds: country.topArtists.slice(0, 5).map((a) => a.id),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { playlistUrl: string };
      setPlaylistUrl(data.playlistUrl);
      setPlaylistFor(country.countryCode);
    } catch (err) {
      console.error("Playlist creation failed:", err);
    } finally {
      setCreatingFor(null);
    }
  };

  if (activeCountry) {
    const cc = activeCountry.countryCode;
    return (
      <CountryDetailView
        country={activeCountry}
        onBack={() => onSelectCountry(null)}
        onCreatePlaylist={handleCreatePlaylist}
        creatingPlaylist={creatingFor === cc}
        playlistUrl={playlistFor === cc ? playlistUrl : null}
      />
    );
  }

  return <StatsOverview countryData={countryData} onSelectCountry={onSelectCountry} />;
}

// ---- Stats Overview ----

function StatsOverview({
  countryData,
  onSelectCountry,
}: {
  countryData: CountryData[];
  onSelectCountry: (c: CountryData) => void;
}) {
  const totalArtists = countryData.reduce((s, c) => s + c.artistCount, 0);
  const totalTracks = countryData.reduce((s, c) => s + c.trackCount, 0);

  if (countryData.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-3">
        <div className="text-4xl">🌍</div>
        <p className="text-sm text-muted">Select a time range to see your music passport.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header stats */}
      <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
        <h2 className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">
          Music Passport
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={countryData.length} label="Countries" accent />
          <Stat value={totalArtists} label="Artists" />
          <Stat value={totalTracks} label="Tracks" />
        </div>
      </div>

      {/* Country list */}
      <div className="px-5 pt-4 pb-1 shrink-0">
        <h3 className="text-[11px] font-semibold text-muted uppercase tracking-widest">
          Top Countries
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-4">
        {countryData.map((country, idx) => (
          <CountryRow
            key={country.countryCode}
            country={country}
            rank={idx + 1}
            maxArtists={countryData[0].artistCount}
            onClick={() => onSelectCountry(country)}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>{value}</div>
      <div className="text-[11px] text-muted mt-0.5">{label}</div>
    </div>
  );
}

function CountryRow({
  country,
  rank,
  maxArtists,
  onClick,
}: {
  country: CountryData;
  rank: number;
  maxArtists: number;
  onClick: () => void;
}) {
  const barWidth = Math.max(4, Math.round((country.artistCount / maxArtists) * 100));
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-surface-elevated transition-colors text-left group"
    >
      <span className="text-[11px] font-mono text-muted w-4 shrink-0 text-right">{rank}</span>
      <span className="text-lg w-7 text-center shrink-0">{getCountryFlag(country.countryCode)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium group-hover:text-accent transition-colors truncate">
            {country.countryName}
          </span>
          <span className="text-xs text-muted shrink-0">{country.artistCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-surface-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${barWidth}%`, opacity: 0.7 }}
            />
          </div>
          {country.languages.length > 0 && (
            <span className="text-[10px] text-muted shrink-0 font-medium truncate max-w-[80px]">{country.languages.join(", ")}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ---- Country Detail View ----

function CountryDetailView({
  country,
  onBack,
  onCreatePlaylist,
  creatingPlaylist,
  playlistUrl,
}: {
  country: CountryData;
  onBack: () => void;
  onCreatePlaylist: (c: CountryData) => void;
  creatingPlaylist: boolean;
  playlistUrl: string | null;
}) {
  const flag = getCountryFlag(country.countryCode);
  const languages = country.languages.length > 0 ? country.languages : (COUNTRY_LANGUAGE[country.countryCode] || []);
  const languageStr = languages.join(", ");
  const estimatedMinutes = Math.round(country.trackCount * 3.5);

  return (
    <div className="h-full flex flex-col">
      {/* Sticky header */}
      <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mb-3"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Countries
        </button>
        <div className="flex items-start gap-3">
          <span className="text-4xl leading-tight">{flag}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight truncate">{country.countryName}</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted">
              <span>{country.artistCount} artist{country.artistCount !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{country.trackCount} tracks</span>
              <span>·</span>
              <span>~{estimatedMinutes} min</span>
              {languageStr && (
                <>
                  <span>·</span>
                  <span className="text-accent font-medium truncate max-w-[120px]">🗣 {languageStr}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Artists */}
        <div className="px-5 pt-4">
          <h3 className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">
            Artists ({country.topArtists.length})
          </h3>
          <div className="space-y-1">
            {country.topArtists.map((artist) => (
              <a
                key={artist.id}
                href={artist.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-surface-elevated transition-colors group"
              >
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-border"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-muted shrink-0">
                    ♪
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-accent transition-colors truncate">
                    {artist.name}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    {(artist.genres ?? []).length > 0 && (
                      <div className="text-[11px] text-muted truncate max-w-[180px]">
                        🎵 {(artist.genres ?? []).slice(0, 3).join(", ")}
                      </div>
                    )}
                    {languages.length > 0 && (
                      <div className="text-[11px] text-muted/80 truncate">
                        🗣 {languages.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                <svg
                  className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Genres */}
        {country.genres.length > 0 && (
          <div className="px-5 pt-5">
            <h3 className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">
              Genres
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {country.genres.slice(0, 12).map((genre) => (
                <span
                  key={genre}
                  className="px-2.5 py-0.5 text-xs rounded-full bg-accent/10 text-accent border border-accent/20"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Playlist creation */}
        <div className="px-5 pt-5 pb-6">
          <p className="text-xs text-muted mb-3">
            Discover music similar to your top artists from {country.countryName}.
          </p>
          {playlistUrl ? (
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-accent text-black text-sm font-semibold hover:brightness-110 transition-all"
            >
              <SpotifyIcon />
              Open Playlist on Spotify
            </a>
          ) : (
            <button
              onClick={() => onCreatePlaylist(country)}
              disabled={creatingPlaylist}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-accent text-black text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creatingPlaylist ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating playlist…
                </>
              ) : (
                <>
                  <SpotifyIcon />
                  Create Discovery Playlist
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
