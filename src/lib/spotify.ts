const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";

// --- Token Management ---

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

// --- Authenticated Fetch ---

async function spotifyFetch(
  accessToken: string,
  endpoint: string
): Promise<Response> {
  return fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// --- Batch Artist Lookup (fills in images + genres for track-only artists) ---

export async function getArtistsByIds(
  accessToken: string,
  ids: string[]
): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  const artists: SpotifyArtist[] = [];

  // Spotify allows max 50 IDs per request
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await spotifyFetch(
      accessToken,
      `/artists?ids=${batch.join(",")}`
    );
    if (!res.ok) {
      console.error(`[spotify] getArtistsByIds batch failed: ${res.status}`);
      continue;
    }
    const data = (await res.json()) as { artists: (SpotifyArtist | null)[] };
    for (const a of data.artists) {
      if (a) artists.push(a);
    }
  }
  return artists;
}

// --- User Profile ---

export interface SpotifyUser {
  id: string;
  display_name: string;
  images: { url: string }[];
  country: string;
}

export async function getCurrentUser(
  accessToken: string
): Promise<SpotifyUser> {
  const res = await spotifyFetch(accessToken, "/me");
  if (!res.ok) throw new Error(`Failed to get user: ${res.status}`);
  return res.json();
}

// --- Top Items ---

export type TimeRange = "short_term" | "medium_term" | "long_term";

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  popularity: number;
  images: { url: string; height: number; width: number }[];
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

export async function getTopArtists(
  accessToken: string,
  timeRange: TimeRange = "medium_term"
): Promise<SpotifyArtist[]> {
  const PAGE_SIZE = 50;
  const artists: SpotifyArtist[] = [];
  let offset = 0;

  while (true) {
    const res = await spotifyFetch(
      accessToken,
      `/me/top/artists?time_range=${timeRange}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!res.ok) throw new Error(`Failed to get top artists: ${res.status}`);
    const data = await res.json() as { items: SpotifyArtist[]; total: number };

    artists.push(...data.items);

    // Stop when we've received all items or got an empty page
    if (artists.length >= data.total || data.items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return artists;
}

export async function getTopTracks(
  accessToken: string,
  timeRange: TimeRange = "medium_term"
): Promise<SpotifyTrack[]> {
  const PAGE_SIZE = 50;
  const tracks: SpotifyTrack[] = [];
  let offset = 0;

  while (true) {
    const res = await spotifyFetch(
      accessToken,
      `/me/top/tracks?time_range=${timeRange}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!res.ok) throw new Error(`Failed to get top tracks: ${res.status}`);
    const data = await res.json() as { items: SpotifyTrack[]; total: number };

    tracks.push(...data.items);

    if (tracks.length >= data.total || data.items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return tracks;
}

export async function getRecentlyPlayed(
  accessToken: string,
  limit: number = 50
): Promise<{ track: SpotifyTrack; played_at: string }[]> {
  const res = await spotifyFetch(
    accessToken,
    `/me/player/recently-played?limit=${limit}`
  );
  if (!res.ok)
    throw new Error(`Failed to get recently played: ${res.status}`);
  const data = await res.json();
  return data.items;
}

// --- Recommendations ---

export interface RecommendationParams {
  seed_artists?: string[];
  seed_genres?: string[];
  seed_tracks?: string[];
  market?: string;
  limit?: number;
}

export async function getRecommendations(
  accessToken: string,
  params: RecommendationParams
): Promise<SpotifyTrack[]> {
  const searchParams = new URLSearchParams();
  if (params.seed_artists?.length)
    searchParams.set("seed_artists", params.seed_artists.slice(0, 5).join(","));
  if (params.seed_genres?.length)
    searchParams.set("seed_genres", params.seed_genres.slice(0, 5).join(","));
  if (params.seed_tracks?.length)
    searchParams.set("seed_tracks", params.seed_tracks.slice(0, 5).join(","));
  if (params.market) searchParams.set("market", params.market);
  searchParams.set("limit", String(params.limit || 20));

  const totalSeeds =
    (params.seed_artists?.length || 0) +
    (params.seed_genres?.length || 0) +
    (params.seed_tracks?.length || 0);
  if (totalSeeds === 0 || totalSeeds > 5) {
    throw new Error("Recommendations require 1-5 total seeds");
  }

  const res = await spotifyFetch(
    accessToken,
    `/recommendations?${searchParams}`
  );
  if (!res.ok)
    throw new Error(`Failed to get recommendations: ${res.status}`);
  const data = await res.json();
  return data.tracks;
}

// --- Playlist Creation ---

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string,
  isPublic: boolean = false
): Promise<{ id: string; external_urls: { spotify: string } }> {
  const res = await fetch(`${SPOTIFY_API_BASE}/users/${userId}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
      public: isPublic,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create playlist: ${res.status}`);
  return res.json();
}

export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  // Spotify allows max 100 tracks per request
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const res = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: batch }),
      }
    );
    if (!res.ok)
      throw new Error(`Failed to add tracks to playlist: ${res.status}`);
  }
}
