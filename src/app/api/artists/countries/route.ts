import { NextRequest } from "next/server";
import { getValidAccessToken } from "@/lib/auth-helpers";
import { getCachedArtists, upsertArtist } from "@/lib/db";
import { searchArtist } from "@/lib/musicbrainz";

type StreamMsg =
  | { type: "batch"; artists: { id: string; countryCode: string | null; name: string }[] }
  | { type: "artist"; id: string; countryCode: string | null; name: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const send = (ctrl: ReadableStreamDefaultController, msg: StreamMsg) => {
    ctrl.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const auth = await getValidAccessToken();
        if (!auth) {
          send(controller, { type: "error", message: "Unauthorized" });
          controller.close();
          return;
        }

        let body: { artists: { id: string; name: string; genres?: string[]; imageUrl?: string | null }[] };
        try {
          body = await request.json();
        } catch {
          send(controller, { type: "error", message: "Invalid JSON body" });
          controller.close();
          return;
        }

        if (!Array.isArray(body.artists) || body.artists.length === 0) {
          send(controller, { type: "error", message: "artists array is required" });
          controller.close();
          return;
        }

        const artistsInput = body.artists;
        const spotifyIds = artistsInput.map((a) => a.id);
        const cached = await getCachedArtists(spotifyIds);
        const uncachedArtists = artistsInput.filter((a) => !cached.has(a.id));

        console.log(`[countries] Input: ${artistsInput.length}, Cached: ${cached.size}, Uncached: ${uncachedArtists.length}`);

        // Send all cached artists immediately as a batch — zero wait
        if (cached.size > 0) {
          send(controller, {
            type: "batch",
            artists: Array.from(cached.entries()).map(([id, a]) => ({
              id,
              countryCode: a.country_code,
              name: a.name,
            })),
          });
        }

        // Resolve uncached artists one at a time (MusicBrainz rate limit: 1 req/s)
        for (const artist of uncachedArtists) {
          try {
            const mbResult = await searchArtist(artist.name, artist.genres);
            await upsertArtist({
              spotify_id: artist.id,
              name: artist.name,
              country_code: mbResult?.countryCode || null,
              language: null,
              genres: (artist.genres ?? []).join(",") || null,
              musicbrainz_id: mbResult?.mbid || null,
              image_url: artist.imageUrl ?? null,
            });
            console.log(`[countries]   resolved: ${artist.name} => ${mbResult?.countryCode || "NULL"}`);
            send(controller, {
              type: "artist",
              id: artist.id,
              countryCode: mbResult?.countryCode || null,
              name: artist.name,
            });
          } catch (err) {
            console.error(`[countries] Failed to resolve "${artist.name}":`, err);
            send(controller, { type: "artist", id: artist.id, countryCode: null, name: artist.name });
          }
        }

        send(controller, { type: "done" });
        controller.close();
      } catch (error) {
        console.error("Countries route failed:", error);
        try {
          send(controller, { type: "error", message: "Failed to resolve countries" });
          controller.close();
        } catch {
          // controller may already be closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
