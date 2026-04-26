import { NextRequest } from "next/server";
import { getValidAccessToken } from "@/lib/auth-helpers";
import { getCachedArtists, upsertArtist } from "@/lib/db";
import { searchArtist } from "@/lib/musicbrainz";

type StreamMsg =
  | { type: "batch"; artists: { id: string; countryCode: string | null; name: string; genres?: string[] }[] }
  | { type: "artist"; id: string; countryCode: string | null; name: string; genres?: string[] }
  | { type: "done" }
  | { type: "error"; message: string };

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const send = (ctrl: ReadableStreamDefaultController, msg: StreamMsg) => {
    try {
      ctrl.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));
    } catch {
      // The stream was likely aborted by the client, safe to ignore
    }
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

        // Build a map of incoming genres/images from Spotify for quick lookup
        const spotifyDataMap = new Map(artistsInput.map((a) => [a.id, a]));

        const cached = await getCachedArtists(spotifyIds);
        const uncachedArtists = artistsInput.filter((a) => !cached.has(a.id));

        console.log(`[countries] Input: ${artistsInput.length}, Cached: ${cached.size}, Uncached: ${uncachedArtists.length}`);

        // Separate cached artists into those with genres and those without
        // Artists cached before MB genres were stored need re-resolution to get genres
        const cachedWithGenres = new Map<string, typeof cached extends Map<string, infer V> ? V : never>();
        const cachedMissingGenres: typeof uncachedArtists = [];

        for (const [id, a] of cached.entries()) {
          // genres is null  → never resolved yet, needs MB lookup
          // genres is ""    → resolved but artist has no genres (e.g. Spotify deprecated them)
          //                   Don't re-hit MB every time; treat as resolved with empty genres
          // genres is "x,y" → has genres, send immediately
          if (a.genres !== null) {
            cachedWithGenres.set(id, a);
          } else {
            // Truly uncached genres — needs MusicBrainz lookup
            const input = spotifyDataMap.get(id);
            if (input) {
              cachedMissingGenres.push(input);
            }
          }
        }

        if (cachedMissingGenres.length > 0) {
          console.log(`[countries] ${cachedMissingGenres.length} cached artists need genre backfill from MusicBrainz`);
        }

        // Send cached-with-genres artists immediately as a batch — zero wait
        if (cachedWithGenres.size > 0) {
          send(controller, {
            type: "batch",
            artists: Array.from(cachedWithGenres.entries()).map(([id, a]) => ({
              id,
              countryCode: a.country_code,
              name: a.name,
              genres: a.genres ? a.genres.split(",") : undefined,
            })),
          });
        }

        // Also send cached-without-genres artists immediately (with country code, no genres yet)
        // so the globe populates quickly — MusicBrainz genres will arrive later via individual messages
        if (cachedMissingGenres.length > 0) {
          send(controller, {
            type: "batch",
            artists: cachedMissingGenres.map((a) => {
              const c = cached.get(a.id)!;
              return { id: a.id, countryCode: c.country_code, name: c.name };
            }),
          });
        }

        // Combine uncached + cached-without-genres for MusicBrainz resolution
        const toResolve = [...uncachedArtists, ...cachedMissingGenres];

        // Resolve artists one at a time (MusicBrainz rate limit: 1 req/s)
        for (const artist of toResolve) {
          try {
            const mbResult = await searchArtist(artist.name, artist.genres);
            // Prefer MusicBrainz genres over Spotify (Spotify deprecated genres)
            const resolvedGenres = mbResult?.genres?.length
              ? mbResult.genres
              : (artist.genres ?? []);
            await upsertArtist({
              spotify_id: artist.id,
              name: artist.name,
              country_code: mbResult?.countryCode || null,
              language: null,
              genres: resolvedGenres.join(",") || null,
              musicbrainz_id: mbResult?.mbid || null,
              image_url: artist.imageUrl ?? null,
            });
            console.log(`[countries]   resolved: ${artist.name} => ${mbResult?.countryCode || "NULL"} (${resolvedGenres.length} genres)`);
            send(controller, {
              type: "artist",
              id: artist.id,
              countryCode: mbResult?.countryCode || null,
              name: artist.name,
              genres: resolvedGenres.length > 0 ? resolvedGenres : undefined,
            });
          } catch (err) {
            console.error(`[countries] Failed to resolve "${artist.name}":`, err);
            send(controller, { type: "artist", id: artist.id, countryCode: null, name: artist.name });
          }
        }

        send(controller, { type: "done" });
        try { controller.close(); } catch { /* already closed */ }
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
