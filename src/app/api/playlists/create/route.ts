import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth-helpers";
import { getSession } from "@/lib/session";
import {
  getRecommendations,
  createPlaylist,
  addTracksToPlaylist,
  getCurrentUser,
} from "@/lib/spotify";

export async function POST(request: NextRequest) {
  const auth = await getValidAccessToken();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    countryCode: string;
    countryName: string;
    seedArtistIds: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.countryCode ||
    !body.countryName ||
    !Array.isArray(body.seedArtistIds) ||
    body.seedArtistIds.length === 0
  ) {
    return NextResponse.json(
      { error: "countryCode, countryName, and seedArtistIds are required" },
      { status: 400 }
    );
  }

  const seedArtists = body.seedArtistIds.slice(0, 5);

  try {
    // Get recommendations based on seed artists
    const tracks = await getRecommendations(auth.accessToken, {
      seed_artists: seedArtists,
      limit: 30,
      market: body.countryCode,
    });

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No recommendations found for this country" },
        { status: 404 }
      );
    }

    // Get user ID for playlist creation
    const user = await getCurrentUser(auth.accessToken);

    // Create playlist
    const playlist = await createPlaylist(
      auth.accessToken,
      user.id,
      `Globify: ${body.countryName}`,
      `Discover music from ${body.countryName} — curated by Globify based on your listening habits.`,
      false
    );

    // Add tracks
    const trackUris = tracks.map((t) => t.uri);
    await addTracksToPlaylist(auth.accessToken, playlist.id, trackUris);

    return NextResponse.json({
      playlistId: playlist.id,
      playlistUrl: playlist.external_urls.spotify,
      trackCount: trackUris.length,
    });
  } catch (err) {
    console.error("Playlist creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}
