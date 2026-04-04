import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth-helpers";
import {
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
  getArtistsByIds,
  type TimeRange,
} from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const auth = await getValidAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeRange = (searchParams.get("time_range") || "medium_term") as TimeRange;

  try {
    const [artists, tracks, recentlyPlayed] = await Promise.all([
      getTopArtists(auth.accessToken, timeRange),
      getTopTracks(auth.accessToken, timeRange),
      getRecentlyPlayed(auth.accessToken, 50),
    ]);

    console.log(`[top-items] Fetched ${artists.length} artists, ${tracks.length} tracks, ${recentlyPlayed.length} recent`);

    // Build a map of all known artists (top artists have full data)
    const artistMap = new Map<string, {
      id: string;
      name: string;
      genres: string[];
      imageUrl: string | null;
      spotifyUrl: string;
    }>();

    for (const a of artists) {
      artistMap.set(a.id, {
        id: a.id,
        name: a.name,
        genres: a.genres ?? [],
        imageUrl: a.images?.[0]?.url || null,
        spotifyUrl: a.external_urls?.spotify || `https://open.spotify.com/artist/${a.id}`,
      });
    }

    // Collect all unique artist IDs from tracks + recently played
    const allTrackItems = [
      ...tracks,
      ...recentlyPlayed.map((item) => item.track),
    ];

    const slimTracks: { id: string; artistIds: string[] }[] = [];
    const missingArtists = new Map<string, string>();

    for (const track of allTrackItems) {
      if (!track.artists) continue;
      
      const validArtists = track.artists.filter((a) => a && a.id);
      
      slimTracks.push({
        id: track.id,
        artistIds: validArtists.map((a) => a.id),
      });

      for (const ta of validArtists) {
        if (!artistMap.has(ta.id)) {
          missingArtists.set(ta.id, ta.name || ta.id);
        }
      }
    }

    // Fetch full details for track-only artists (images, genres)
    if (missingArtists.size > 0) {
      console.log(`[top-items] Enriching ${missingArtists.size} track-only artists...`);
      // Only request valid Spotify base62 IDs to prevent 400 Bad Request batch failures
      const validIdsForApi = Array.from(missingArtists.keys()).filter(id => /^[a-zA-Z0-9]{22}$/.test(id));
      const enriched = validIdsForApi.length > 0 ? await getArtistsByIds(auth.accessToken, validIdsForApi) : [];
      
      for (const a of enriched) {
        if (!a) continue;
        artistMap.set(a.id, {
          id: a.id,
          name: a.name || missingArtists.get(a.id) || a.id,
          genres: a.genres ?? [],
          imageUrl: a.images?.[0]?.url || null,
          spotifyUrl: a.external_urls?.spotify || `https://open.spotify.com/artist/${a.id}`,
        });
      }
      // Any IDs that still failed — add stubs
      for (const [id, name] of missingArtists.entries()) {
        if (!artistMap.has(id)) {
          artistMap.set(id, {
            id,
            name,
            genres: [],
            imageUrl: null,
            spotifyUrl: `https://open.spotify.com/artist/${id}`,
          });
        }
      }
    }

    const allArtists = Array.from(artistMap.values());
    console.log(`[top-items] Total unique artists: ${allArtists.length}`);

    return NextResponse.json({
      artists: allArtists,
      tracks: slimTracks,
      timeRange,
    });
  } catch (err) {
    console.error("Error fetching top items:", err);
    return NextResponse.json(
      { error: "Failed to fetch Spotify data" },
      { status: 500 }
    );
  }
}
