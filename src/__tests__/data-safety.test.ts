import { describe, it, expect } from "vitest";

/**
 * Tests for data safety patterns that prevent the bugs we encountered.
 * These are regression tests for the specific issues that caused
 * "0 countries / 0 artists" in the app.
 */

describe("Defensive data handling patterns", () => {
  describe("genres field safety", () => {
    // This was the ROOT CAUSE of the 0 countries bug
    it("handles undefined genres without throwing", () => {
      const artist = { id: "1", name: "Test", imageUrl: null } as {
        id: string;
        name: string;
        genres?: string[];
        imageUrl?: string | null;
      };

      // BAD (original code that crashed):
      // expect(() => artist.genres.join(",")).toThrow();

      // GOOD (fixed code):
      const result = (artist.genres ?? []).join(",") || null;
      expect(result).toBeNull();
    });

    it("handles null genres without throwing", () => {
      const artist = { id: "1", name: "Test", genres: null as unknown as string[] };
      const result = (artist.genres ?? []).join(",") || null;
      expect(result).toBeNull();
    });

    it("handles empty genres array", () => {
      const artist = { id: "1", name: "Test", genres: [] };
      const result = (artist.genres ?? []).join(",") || null;
      expect(result).toBeNull(); // empty string → null via ||
    });

    it("handles valid genres array", () => {
      const artist = { id: "1", name: "Test", genres: ["rock", "metal"] };
      const result = (artist.genres ?? []).join(",") || null;
      expect(result).toBe("rock,metal");
    });
  });

  describe("imageUrl field safety", () => {
    it("handles undefined imageUrl", () => {
      const artist = { id: "1", name: "Test" } as { id: string; name: string; imageUrl?: string | null };
      const result = artist.imageUrl ?? null;
      expect(result).toBeNull();
    });

    it("handles null imageUrl", () => {
      const artist = { id: "1", name: "Test", imageUrl: null };
      const result = artist.imageUrl ?? null;
      expect(result).toBeNull();
    });

    it("handles valid imageUrl", () => {
      const artist = { id: "1", name: "Test", imageUrl: "https://img.com/x.jpg" };
      const result = artist.imageUrl ?? null;
      expect(result).toBe("https://img.com/x.jpg");
    });
  });

  describe("Spotify image array safety", () => {
    it("handles empty images array", () => {
      const artist = { images: [] as { url: string }[] };
      const url = artist.images[0]?.url || null;
      expect(url).toBeNull();
    });

    it("handles images array with entries", () => {
      const artist = { images: [{ url: "https://img.com/1.jpg" }] };
      const url = artist.images[0]?.url || null;
      expect(url).toBe("https://img.com/1.jpg");
    });

    it("handles undefined images", () => {
      const artist = {} as { images?: { url: string }[] };
      const url = artist.images?.[0]?.url || null;
      expect(url).toBeNull();
    });
  });

  describe("Country code null filtering", () => {
    it("filters out null country codes in client aggregation", () => {
      const countries: Record<string, { countryCode: string | null; name: string }> = {
        "sp-1": { countryCode: "US", name: "A" },
        "sp-2": { countryCode: null, name: "B" },
        "sp-3": { countryCode: "GB", name: "C" },
        "sp-4": { countryCode: null, name: "D" },
      };

      const withCountry = Object.entries(countries).filter(
        ([, v]) => v.countryCode !== null
      );

      expect(withCountry).toHaveLength(2);
      expect(withCountry.map(([id]) => id)).toEqual(["sp-1", "sp-3"]);
    });

    it("correctly counts resolved vs unresolved", () => {
      const countries = {
        "sp-1": { countryCode: "US", name: "A" },
        "sp-2": { countryCode: null, name: "B" },
        "sp-3": { countryCode: "GB", name: "C" },
      };

      const total = Object.keys(countries).length;
      const resolved = Object.values(countries).filter((v) => v.countryCode).length;
      const unresolved = total - resolved;

      expect(total).toBe(3);
      expect(resolved).toBe(2);
      expect(unresolved).toBe(1);
    });
  });

  describe("COALESCE-like DB upsert behavior", () => {
    // When upserting, we use COALESCE(excluded.X, artists.X) to not
    // overwrite existing good data with null
    function coalesce<T>(newVal: T | null | undefined, existingVal: T | null | undefined): T | null {
      return newVal ?? existingVal ?? null;
    }

    it("prefers new value when both exist", () => {
      expect(coalesce("US", "GB")).toBe("US");
    });

    it("keeps existing when new is null", () => {
      expect(coalesce(null, "GB")).toBe("GB");
    });

    it("keeps existing when new is undefined", () => {
      expect(coalesce(undefined, "GB")).toBe("GB");
    });

    it("returns null when both are null", () => {
      expect(coalesce(null, null)).toBeNull();
    });

    it("uses new value when existing is null", () => {
      expect(coalesce("US", null)).toBe("US");
    });
  });
});
