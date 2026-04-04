import { describe, it, expect } from "vitest";

/**
 * Tests for the GlobeView client-side aggregation logic.
 * This is the code that converts the API response into CountryData[]
 * for rendering on the globe.
 */

interface CountriesResponse {
  countries: Record<string, { countryCode: string | null; name: string }>;
}

interface Artist {
  id: string;
  name: string;
  genres?: string[];
  images: { url: string }[];
  external_urls: { spotify: string };
}

interface Track {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { images: { url: string }[] };
  external_urls: { spotify: string };
}

function aggregateForGlobe(
  artists: Artist[],
  tracks: Track[],
  countriesData: CountriesResponse
) {
  const countryMap = new Map<
    string,
    {
      artists: Map<string, { id: string; name: string; imageUrl: string | null; genres: string[]; spotifyUrl: string }>;
      tracks: Set<string>;
      genres: Set<string>;
    }
  >();

  for (const artist of artists) {
    const mapping = countriesData.countries[artist.id];
    const cc = mapping?.countryCode || null;
    if (!cc) continue;

    if (!countryMap.has(cc)) {
      countryMap.set(cc, {
        artists: new Map(),
        tracks: new Set(),
        genres: new Set(),
      });
    }

    const entry = countryMap.get(cc)!;
    if (!entry.artists.has(artist.id)) {
      entry.artists.set(artist.id, {
        id: artist.id,
        name: artist.name,
        imageUrl: artist.images[0]?.url || null,
        genres: artist.genres ?? [],
        spotifyUrl: artist.external_urls.spotify,
      });
    }
    (artist.genres ?? []).forEach((g) => entry.genres.add(g));
  }

  for (const track of tracks) {
    for (const ta of track.artists) {
      const mapping = countriesData.countries[ta.id];
      const cc = mapping?.countryCode || null;
      if (cc && countryMap.has(cc)) {
        countryMap.get(cc)!.tracks.add(track.id);
      }
    }
  }

  const result = [];
  for (const [cc, data] of countryMap) {
    result.push({
      countryCode: cc,
      artistCount: data.artists.size,
      trackCount: data.tracks.size,
      genres: Array.from(data.genres),
    });
  }
  result.sort((a, b) => b.artistCount - a.artistCount);
  return result;
}

describe("GlobeView client-side aggregation", () => {
  const mockArtists: Artist[] = [
    {
      id: "sp-1",
      name: "Taylor Swift",
      genres: ["pop", "country"],
      images: [{ url: "https://img.com/1.jpg" }],
      external_urls: { spotify: "https://spotify.com/artist/1" },
    },
    {
      id: "sp-2",
      name: "Ed Sheeran",
      genres: ["pop", "singer-songwriter"],
      images: [{ url: "https://img.com/2.jpg" }],
      external_urls: { spotify: "https://spotify.com/artist/2" },
    },
    {
      id: "sp-3",
      name: "BTS",
      genres: ["k-pop"],
      images: [{ url: "https://img.com/3.jpg" }],
      external_urls: { spotify: "https://spotify.com/artist/3" },
    },
  ];

  const mockTracks: Track[] = [
    {
      id: "t-1",
      name: "Song 1",
      artists: [{ id: "sp-1", name: "Taylor Swift" }],
      album: { images: [{ url: "https://img.com/a1.jpg" }] },
      external_urls: { spotify: "https://spotify.com/track/1" },
    },
    {
      id: "t-2",
      name: "Song 2",
      artists: [{ id: "sp-2", name: "Ed Sheeran" }],
      album: { images: [{ url: "https://img.com/a2.jpg" }] },
      external_urls: { spotify: "https://spotify.com/track/2" },
    },
  ];

  it("correctly groups artists by country", () => {
    const countriesData: CountriesResponse = {
      countries: {
        "sp-1": { countryCode: "US", name: "Taylor Swift" },
        "sp-2": { countryCode: "GB", name: "Ed Sheeran" },
        "sp-3": { countryCode: "KR", name: "BTS" },
      },
    };

    const result = aggregateForGlobe(mockArtists, mockTracks, countriesData);

    expect(result).toHaveLength(3);
    const us = result.find((r) => r.countryCode === "US");
    const gb = result.find((r) => r.countryCode === "GB");
    const kr = result.find((r) => r.countryCode === "KR");

    expect(us!.artistCount).toBe(1);
    expect(us!.trackCount).toBe(1);
    expect(gb!.artistCount).toBe(1);
    expect(gb!.trackCount).toBe(1);
    expect(kr!.artistCount).toBe(1);
    expect(kr!.trackCount).toBe(0); // no tracks by BTS in our mock
  });

  it("skips artists with null country codes", () => {
    const countriesData: CountriesResponse = {
      countries: {
        "sp-1": { countryCode: "US", name: "Taylor Swift" },
        "sp-2": { countryCode: null, name: "Ed Sheeran" },
        "sp-3": { countryCode: null, name: "BTS" },
      },
    };

    const result = aggregateForGlobe(mockArtists, mockTracks, countriesData);

    expect(result).toHaveLength(1);
    expect(result[0].countryCode).toBe("US");
  });

  it("returns empty array when all country codes are null", () => {
    const countriesData: CountriesResponse = {
      countries: {
        "sp-1": { countryCode: null, name: "Taylor Swift" },
        "sp-2": { countryCode: null, name: "Ed Sheeran" },
        "sp-3": { countryCode: null, name: "BTS" },
      },
    };

    const result = aggregateForGlobe(mockArtists, mockTracks, countriesData);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when artists not in countries map", () => {
    const countriesData: CountriesResponse = {
      countries: {},
    };

    const result = aggregateForGlobe(mockArtists, mockTracks, countriesData);
    expect(result).toHaveLength(0);
  });

  it("groups multiple artists from same country", () => {
    const countriesData: CountriesResponse = {
      countries: {
        "sp-1": { countryCode: "US", name: "Taylor Swift" },
        "sp-2": { countryCode: "US", name: "Ed Sheeran" }, // pretend Ed is US
        "sp-3": { countryCode: "KR", name: "BTS" },
      },
    };

    const result = aggregateForGlobe(mockArtists, mockTracks, countriesData);

    expect(result).toHaveLength(2);
    const us = result.find((r) => r.countryCode === "US");
    expect(us!.artistCount).toBe(2);
    expect(us!.trackCount).toBe(2); // both tracks are by US artists
    expect(us!.genres).toContain("pop");
    expect(us!.genres).toContain("country");
    expect(us!.genres).toContain("singer-songwriter");
  });

  it("sorts by artist count descending", () => {
    const countriesData: CountriesResponse = {
      countries: {
        "sp-1": { countryCode: "GB", name: "Taylor Swift" },
        "sp-2": { countryCode: "US", name: "Ed Sheeran" },
        "sp-3": { countryCode: "US", name: "BTS" },
      },
    };

    const result = aggregateForGlobe(mockArtists, mockTracks, countriesData);

    expect(result[0].countryCode).toBe("US");
    expect(result[0].artistCount).toBe(2);
    expect(result[1].countryCode).toBe("GB");
    expect(result[1].artistCount).toBe(1);
  });

  it("handles artists with no images", () => {
    const artistsNoImages: Artist[] = [
      {
        id: "sp-1",
        name: "No Image Artist",
        genres: ["rock"],
        images: [],
        external_urls: { spotify: "https://spotify.com/artist/1" },
      },
    ];

    const countriesData: CountriesResponse = {
      countries: {
        "sp-1": { countryCode: "US", name: "No Image Artist" },
      },
    };

    const result = aggregateForGlobe(artistsNoImages, [], countriesData);
    expect(result).toHaveLength(1);
  });

  it("handles artists with undefined genres (Simplified Artist object)", () => {
    // Spotify returns SimplifiedArtist from some endpoints — genres field is absent
    const artistsNoGenres: Artist[] = [
      {
        id: "sp-1",
        name: "No Genre Artist",
        // genres is undefined — this is the root cause bug
        images: [{ url: "https://img.com/1.jpg" }],
        external_urls: { spotify: "https://spotify.com/artist/1" },
      },
    ];

    const countriesData: CountriesResponse = {
      countries: {
        "sp-1": { countryCode: "US", name: "No Genre Artist" },
      },
    };

    // Should not throw, should produce a result with empty genres
    const result = aggregateForGlobe(artistsNoGenres, [], countriesData);
    expect(result).toHaveLength(1);
    expect(result[0].genres).toEqual([]);
  });
});
