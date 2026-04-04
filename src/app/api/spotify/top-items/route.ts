import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth-helpers";
import {
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
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
    if (artists.length > 0) {
      console.log(`[top-items] First 5 artists: ${artists.slice(0, 5).map((a: { name: string }) => a.name).join(', ')}`);
    }

    return NextResponse.json({
      artists,
      tracks,
      recentlyPlayed: recentlyPlayed.map((item) => item.track),
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
