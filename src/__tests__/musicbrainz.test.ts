import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the inferCountryCodeFromDescription and isLikelyArtistResult logic
// by importing the module and testing searchArtist with mocked fetch

// Since the functions are not exported directly, we test them through searchArtist
// but first let's test the nationality mapping logic by extracting it

// Re-implement the mapping logic here to test it directly
const NATIONALITY_TO_ISO: Record<string, string> = {
  american: "US",
  british: "GB",
  english: "GB",
  scottish: "GB",
  welsh: "GB",
  irish: "IE",
  canadian: "CA",
  australian: "AU",
  german: "DE",
  french: "FR",
  spanish: "ES",
  italian: "IT",
  swedish: "SE",
  norwegian: "NO",
  danish: "DK",
  dutch: "NL",
  belgian: "BE",
  swiss: "CH",
  austrian: "AT",
  finnish: "FI",
  icelandic: "IS",
  polish: "PL",
  czech: "CZ",
  ukrainian: "UA",
  russian: "RU",
  portuguese: "PT",
  brazilian: "BR",
  mexican: "MX",
  colombian: "CO",
  argentine: "AR",
  argentinian: "AR",
  chilean: "CL",
  peruvian: "PE",
  venezuelan: "VE",
  "puerto rican": "PR",
  cuban: "CU",
  jamaican: "JM",
  trinidadian: "TT",
  nigerian: "NG",
  ghanaian: "GH",
  "south african": "ZA",
  kenyan: "KE",
  egyptian: "EG",
  moroccan: "MA",
  algerian: "DZ",
  tunisian: "TN",
  indian: "IN",
  pakistani: "PK",
  bangladeshi: "BD",
  "sri lankan": "LK",
  nepali: "NP",
  chinese: "CN",
  "hong kong": "HK",
  taiwanese: "TW",
  japanese: "JP",
  "south korean": "KR",
  korean: "KR",
  thai: "TH",
  vietnamese: "VN",
  indonesian: "ID",
  malaysian: "MY",
  singaporean: "SG",
  filipino: "PH",
  philippine: "PH",
  "new zealand": "NZ",
  israeli: "IL",
  turkish: "TR",
  lebanese: "LB",
};

function inferCountryCodeFromDescription(description: string): string | null {
  const normalized = description.toLowerCase();
  for (const [nationality, iso] of Object.entries(NATIONALITY_TO_ISO)) {
    if (normalized.includes(nationality)) {
      return iso;
    }
  }
  return null;
}

describe("inferCountryCodeFromDescription", () => {
  it("detects nationality from Wikidata descriptions", () => {
    expect(inferCountryCodeFromDescription("American singer-songwriter (born 1989)")).toBe("US");
    expect(inferCountryCodeFromDescription("Canadian-American rapper and singer (born 1986)")).toBe("US"); // "american" appears first
    expect(inferCountryCodeFromDescription("English singer-songwriter")).toBe("GB");
    expect(inferCountryCodeFromDescription("South Korean musical group; boy band")).toBe("KR");
    expect(inferCountryCodeFromDescription("Puerto Rican rapper, singer, and record producer")).toBe("PR");
    expect(inferCountryCodeFromDescription("Japanese singer and lyricist")).toBe("JP");
    expect(inferCountryCodeFromDescription("Indian musician")).toBe("IN");
    expect(inferCountryCodeFromDescription("Nigerian Afrobeats singer")).toBe("NG");
  });

  it("returns null for descriptions without nationality", () => {
    expect(inferCountryCodeFromDescription("musical group")).toBeNull();
    expect(inferCountryCodeFromDescription("singer-songwriter")).toBeNull();
    expect(inferCountryCodeFromDescription("")).toBeNull();
    expect(inferCountryCodeFromDescription("fictional character")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(inferCountryCodeFromDescription("AMERICAN rapper")).toBe("US");
    expect(inferCountryCodeFromDescription("british rock band")).toBe("GB");
    expect(inferCountryCodeFromDescription("JAPANESE pop duo")).toBe("JP");
  });
});

describe("searchArtist", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns country from MusicBrainz when available", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists: [
          {
            id: "mb-123",
            name: "Taylor Swift",
            country: "US",
            area: { name: "United States", "iso-3166-1-codes": ["US"] },
          },
        ],
      }),
    });

    const { searchArtist } = await import("@/lib/musicbrainz");
    const result = await searchArtist("Taylor Swift");

    expect(result).not.toBeNull();
    expect(result!.countryCode).toBe("US");
    expect(result!.name).toBe("Taylor Swift");

    global.fetch = originalFetch;
  });

  it("falls back to Wikidata when MusicBrainz search fails", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (String(url).includes("musicbrainz.org")) {
        return { ok: false, status: 503 };
      }
      // Wikidata response
      return {
        ok: true,
        json: async () => ({
          search: [
            {
              label: "Linkin Park",
              description: "American rock band",
            },
          ],
        }),
      };
    });

    const { searchArtist } = await import("@/lib/musicbrainz");
    const result = await searchArtist("Linkin Park");

    expect(result).not.toBeNull();
    expect(result!.countryCode).toBe("US");

    global.fetch = originalFetch;
  });

  it("falls back to Wikidata when MusicBrainz has no country", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (String(url).includes("musicbrainz.org") && String(url).includes("query")) {
        return {
          ok: true,
          json: async () => ({
            artists: [{ id: "mb-456", name: "Unknown Band", area: {} }],
          }),
        };
      }
      if (String(url).includes("musicbrainz.org") && String(url).includes("mb-456")) {
        return {
          ok: true,
          json: async () => ({ area: {} }),
        };
      }
      // Wikidata
      return {
        ok: true,
        json: async () => ({
          search: [
            {
              label: "Unknown Band",
              description: "Swedish rock band",
            },
          ],
        }),
      };
    });

    const { searchArtist } = await import("@/lib/musicbrainz");
    const result = await searchArtist("Unknown Band");

    expect(result).not.toBeNull();
    expect(result!.countryCode).toBe("SE");

    global.fetch = originalFetch;
  });

  it("returns null when both APIs fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { searchArtist } = await import("@/lib/musicbrainz");
    const result = await searchArtist("Nobody");

    // Should return null gracefully, not throw
    expect(result).toBeNull();

    global.fetch = originalFetch;
  });
});
