import type { SpotifyArtist, SpotifyTrack } from "./spotify";
import type { CachedArtist } from "./db";

export interface CountryData {
  countryCode: string;
  countryName: string;
  artistCount: number;
  trackCount: number;
  topArtists: ArtistSummary[];
  genres: string[];
  languages: string[];
}

export interface ArtistSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  spotifyUrl: string;
}

// ISO 3166-1 alpha-2 to country name mapping (common countries)
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  KR: "South Korea",
  BR: "Brazil",
  MX: "Mexico",
  ES: "Spain",
  IT: "Italy",
  SE: "Sweden",
  NO: "Norway",
  NL: "Netherlands",
  IN: "India",
  NG: "Nigeria",
  ZA: "South Africa",
  JM: "Jamaica",
  CO: "Colombia",
  AR: "Argentina",
  PR: "Puerto Rico",
  IE: "Ireland",
  NZ: "New Zealand",
  PT: "Portugal",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  RU: "Russia",
  UA: "Ukraine",
  TR: "Turkey",
  EG: "Egypt",
  KE: "Kenya",
  GH: "Ghana",
  TZ: "Tanzania",
  CU: "Cuba",
  DO: "Dominican Republic",
  CL: "Chile",
  PE: "Peru",
  VE: "Venezuela",
  PH: "Philippines",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  MY: "Malaysia",
  TW: "Taiwan",
  HK: "Hong Kong",
  SG: "Singapore",
  IL: "Israel",
  LB: "Lebanon",
  IS: "Iceland",
  RO: "Romania",
  HU: "Hungary",
  CZ: "Czech Republic",
  GR: "Greece",
  HR: "Croatia",
  RS: "Serbia",
  BG: "Bulgaria",
  SK: "Slovakia",
};

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

export function aggregateByCountry(
  artists: SpotifyArtist[],
  tracks: SpotifyTrack[],
  artistCountryMap: Map<string, CachedArtist>
): CountryData[] {
  const countryMap = new Map<
    string,
    {
      artists: Set<string>;
      artistSummaries: ArtistSummary[];
      tracks: Set<string>;
      genres: Set<string>;
      languages: Set<string>;
    }
  >();

  // Group artists by country
  for (const artist of artists) {
    const cached = artistCountryMap.get(artist.id);
    const countryCode = cached?.country_code || "XX";

    if (!countryMap.has(countryCode)) {
      countryMap.set(countryCode, {
        artists: new Set(),
        artistSummaries: [],
        tracks: new Set(),
        genres: new Set(),
        languages: new Set(),
      });
    }

    const entry = countryMap.get(countryCode)!;

    if (!entry.artists.has(artist.id)) {
      entry.artists.add(artist.id);
      entry.artistSummaries.push({
        id: artist.id,
        name: artist.name,
        imageUrl: artist.images[0]?.url || null,
        genres: artist.genres ?? [],
        spotifyUrl: artist.external_urls.spotify,
      });
    }

    for (const genre of (artist.genres ?? [])) {
      entry.genres.add(genre);
    }

    if (cached?.language) {
      entry.languages.add(cached.language);
    }
  }

  // Count tracks per country
  for (const track of tracks) {
    for (const trackArtist of track.artists) {
      const cached = artistCountryMap.get(trackArtist.id);
      const countryCode = cached?.country_code || "XX";
      const entry = countryMap.get(countryCode);
      if (entry) {
        entry.tracks.add(track.id);
      }
    }
  }

  // Convert to array
  const result: CountryData[] = [];
  for (const [countryCode, data] of countryMap) {
    if (countryCode === "XX") continue; // skip unknown for globe display

    result.push({
      countryCode,
      countryName: getCountryName(countryCode),
      artistCount: data.artists.size,
      trackCount: data.tracks.size,
      topArtists: data.artistSummaries,
      genres: Array.from(data.genres).slice(0, 10),
      languages: Array.from(data.languages),
    });
  }

  // Sort by artist count descending
  result.sort((a, b) => b.artistCount - a.artistCount);
  return result;
}

export function computeGlobeIntensity(
  countryData: CountryData[]
): Map<string, number> {
  if (countryData.length === 0) return new Map();

  const maxArtists = Math.max(...countryData.map((c) => c.artistCount));
  const intensityMap = new Map<string, number>();

  for (const country of countryData) {
    // Logarithmic scale for better visual distribution
    const intensity =
      maxArtists > 1
        ? Math.log(country.artistCount + 1) / Math.log(maxArtists + 1)
        : 1;
    intensityMap.set(country.countryCode, intensity);
  }

  return intensityMap;
}
