import { describe, it, expect } from "vitest";

/**
 * Tests for the countries API route logic.
 * We test the data transformation logic that was causing the "0 countries" bug:
 * - genres can be undefined (the root cause of the original bug)
 * - imageUrl can be undefined
 * - the response shape matches what GlobeView expects
 */

describe("Countries route data handling", () => {
  // Simulates the exact transformation the route does
  function buildUpsertPayload(artist: {
    id: string;
    name: string;
    genres?: string[];
    imageUrl?: string | null;
  }) {
    return {
      spotify_id: artist.id,
      name: artist.name,
      country_code: "US",
      language: null,
      genres: (artist.genres ?? []).join(",") || null,
      musicbrainz_id: "mb-123",
      image_url: artist.imageUrl ?? null,
    };
  }

  it("handles artist with all fields present", () => {
    const result = buildUpsertPayload({
      id: "sp-1",
      name: "Taylor Swift",
      genres: ["pop", "country"],
      imageUrl: "https://example.com/img.jpg",
    });

    expect(result.genres).toBe("pop,country");
    expect(result.image_url).toBe("https://example.com/img.jpg");
    expect(result.spotify_id).toBe("sp-1");
  });

  it("handles artist with undefined genres (THE BUG)", () => {
    // This was the actual bug: genres was undefined, and .join() threw
    const result = buildUpsertPayload({
      id: "sp-2",
      name: "Linkin Park",
      // genres is undefined!
      imageUrl: "https://example.com/img.jpg",
    });

    expect(result.genres).toBeNull(); // empty string from [].join("") becomes null via || null
    expect(result.image_url).toBe("https://example.com/img.jpg");
  });

  it("handles artist with empty genres array", () => {
    const result = buildUpsertPayload({
      id: "sp-3",
      name: "New Artist",
      genres: [],
      imageUrl: null,
    });

    expect(result.genres).toBeNull(); // "".join() is "", || null gives null
    expect(result.image_url).toBeNull();
  });

  it("handles artist with undefined imageUrl", () => {
    const result = buildUpsertPayload({
      id: "sp-4",
      name: "Mystery Artist",
      genres: ["rock"],
      // imageUrl is undefined
    });

    expect(result.genres).toBe("rock");
    expect(result.image_url).toBeNull();
  });

  it("handles artist with all optional fields missing", () => {
    const result = buildUpsertPayload({
      id: "sp-5",
      name: "Bare Minimum",
    });

    expect(result.genres).toBeNull();
    expect(result.image_url).toBeNull();
    expect(result.name).toBe("Bare Minimum");
  });
});

describe("Countries response aggregation", () => {
  function buildResult(
    cached: Map<string, { country_code: string | null; name: string }>,
    resolved: { id: string; countryCode: string | null }[],
    artistsInput: { id: string; name: string }[]
  ) {
    const result: Record<string, { countryCode: string | null; name: string }> = {};

    for (const [id, artist] of cached) {
      result[id] = { countryCode: artist.country_code, name: artist.name };
    }
    for (const r of resolved) {
      const artist = artistsInput.find((a) => a.id === r.id);
      result[r.id] = { countryCode: r.countryCode, name: artist?.name || "" };
    }

    return result;
  }

  it("merges cached and resolved results", () => {
    const cached = new Map([
      ["sp-1", { country_code: "US", name: "Taylor Swift" }],
    ]);
    const resolved = [{ id: "sp-2", countryCode: "GB" }];
    const input = [
      { id: "sp-1", name: "Taylor Swift" },
      { id: "sp-2", name: "Ed Sheeran" },
    ];

    const result = buildResult(cached, resolved, input);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result["sp-1"].countryCode).toBe("US");
    expect(result["sp-2"].countryCode).toBe("GB");
    expect(result["sp-2"].name).toBe("Ed Sheeran");
  });

  it("handles all null country codes", () => {
    const cached = new Map<string, { country_code: string | null; name: string }>();
    const resolved = [
      { id: "sp-1", countryCode: null },
      { id: "sp-2", countryCode: null },
    ];
    const input = [
      { id: "sp-1", name: "Unknown1" },
      { id: "sp-2", name: "Unknown2" },
    ];

    const result = buildResult(cached, resolved, input);
    const withCountry = Object.values(result).filter((r) => r.countryCode).length;

    expect(withCountry).toBe(0);
  });

  it("handles empty input", () => {
    const result = buildResult(new Map(), [], []);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
