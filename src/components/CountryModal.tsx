"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CountryData } from "@/lib/aggregation";

interface Props {
  country: CountryData;
  onClose: () => void;
}

export default function CountryModal({ country, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleCreatePlaylist = async () => {
    setCreatingPlaylist(true);
    try {
      const artistIds = country.topArtists.map((a) => a.id);
      const res = await fetch("/api/playlists/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: country.countryCode,
          countryName: country.countryName,
          seedArtistIds: artistIds.slice(0, 5),
        }),
      });
      if (!res.ok) throw new Error("Failed to create playlist");
      const data = await res.json();
      setPlaylistUrl(data.playlistUrl);
    } catch (err) {
      console.error("Playlist creation failed:", err);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold">{country.countryName}</h2>
            <p className="text-sm text-muted mt-1">
              {country.artistCount} artist{country.artistCount !== 1 ? "s" : ""} ·{" "}
              {country.trackCount} track{country.trackCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#222] transition-colors text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Artists */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Top Artists
          </h3>
          <div className="space-y-3">
            {country.topArtists.map((artist) => (
              <a
                key={artist.id}
                href={artist.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-[#1a1a1a] transition-colors group"
              >
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center text-muted text-sm">
                    ♪
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate group-hover:text-accent transition-colors">
                    {artist.name}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {(artist.genres ?? []).slice(0, 3).join(", ")}
                  </div>
                </div>
                <svg
                  className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity"
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

          {/* Genres */}
          {country.genres.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                Genres
              </h3>
              <div className="flex flex-wrap gap-2">
                {country.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 text-xs rounded-full bg-accent/10 text-accent border border-accent/20"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Playlist Creation */}
          <div className="mt-6 pt-6 border-t border-border">
            {playlistUrl ? (
              <a
                href={playlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-accent text-black font-semibold hover:scale-[1.02] active:scale-95 transition-transform"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Open Playlist in Spotify
              </a>
            ) : (
              <button
                onClick={handleCreatePlaylist}
                disabled={creatingPlaylist}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-accent text-black font-semibold hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {creatingPlaylist ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Creating playlist...
                  </>
                ) : (
                  <>Create {country.countryName} Playlist</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
