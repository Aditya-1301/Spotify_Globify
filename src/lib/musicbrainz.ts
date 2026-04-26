const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
const WIKIDATA_SEARCH_BASE = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "Globify/1.0.0 (https://github.com/globify)";

// ISO nationality adjective / country-name → ISO alpha-2
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
  slovak: "SK",
  hungarian: "HU",
  romanian: "RO",
  bulgarian: "BG",
  serbian: "RS",
  croatian: "HR",
  slovenian: "SI",
  albanian: "AL",
  macedonian: "MK",
  bosnian: "BA",
  montenegrin: "ME",
  kosovan: "XK",
  greek: "GR",
  ukrainian: "UA",
  russian: "RU",
  belarusian: "BY",
  georgian: "GE",
  armenian: "AM",
  azerbaijani: "AZ",
  kazakhstani: "KZ",
  uzbek: "UZ",
  estonian: "EE",
  latvian: "LV",
  lithuanian: "LT",
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
  tanzanian: "TZ",
  ugandan: "UG",
  senegalese: "SN",
  ivorian: "CI",
  cameroonian: "CM",
  congolese: "CD",
  egyptian: "EG",
  moroccan: "MA",
  algerian: "DZ",
  tunisian: "TN",
  libyan: "LY",
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
  burmese: "MM",
  cambodian: "KH",
  "new zealand": "NZ",
  israeli: "IL",
  turkish: "TR",
  lebanese: "LB",
  saudi: "SA",
  emirati: "AE",
  kuwaiti: "KW",
  qatari: "QA",
  bahraini: "BH",
  jordanian: "JO",
  iraqi: "IQ",
  iranian: "IR",
  afghan: "AF",
};

// Country name phrases (for "from [country]" style Wikidata descriptions)
const COUNTRY_NAME_TO_ISO: Array<[RegExp, string]> = [
  [/\bfrom albania\b|\balbania\b/, "AL"],
  [/\bfrom austria\b|\baustria\b/, "AT"],
  [/\bfrom germany\b|\bgermany\b/, "DE"],
  [/\bfrom france\b|\bfrance\b/, "FR"],
  [/\bfrom spain\b|\bspain\b/, "ES"],
  [/\bfrom italy\b|\bitaly\b/, "IT"],
  [/\bfrom sweden\b|\bsweden\b/, "SE"],
  [/\bfrom norway\b|\bnorway\b/, "NO"],
  [/\bfrom denmark\b|\bdenmark\b/, "DK"],
  [/\bfrom netherlands\b|\bnetherlands\b|\bholland\b/, "NL"],
  [/\bfrom poland\b|\bpoland\b/, "PL"],
  [/\bfrom romania\b|\bromania\b/, "RO"],
  [/\bfrom serbia\b|\bserbia\b/, "RS"],
  [/\bfrom croatia\b|\bcroatia\b/, "HR"],
  [/\bfrom greece\b|\bgreece\b/, "GR"],
  [/\bfrom ukraine\b|\bukraine\b/, "UA"],
  [/\bfrom russia\b|\brussia\b/, "RU"],
  [/\bfrom turkey\b|\bturkey\b/, "TR"],
  [/\bfrom nigeria\b|\bnigeria\b/, "NG"],
  [/\bfrom ghana\b|\bghana\b/, "GH"],
  [/\bfrom south africa\b|\bsouth africa\b/, "ZA"],
  [/\bfrom india\b|\bindia\b/, "IN"],
  [/\bfrom pakistan\b|\bpakistan\b/, "PK"],
  [/\bfrom china\b|\bchina\b/, "CN"],
  [/\bfrom taiwan\b|\btaiwan\b/, "TW"],
  [/\bfrom hong kong\b|\bhong kong\b/, "HK"],
  [/\bfrom japan\b|\bjapan\b/, "JP"],
  [/\bfrom south korea\b|\bsouth korea\b/, "KR"],
  [/\bfrom thailand\b|\bthailand\b/, "TH"],
  [/\bfrom indonesia\b|\bindonesia\b/, "ID"],
  [/\bfrom brazil\b|\bbrazil\b/, "BR"],
  [/\bfrom mexico\b|\bmexico\b/, "MX"],
  [/\bfrom colombia\b|\bcolombia\b/, "CO"],
  [/\bfrom argentina\b|\bargentina\b/, "AR"],
  [/\bfrom chile\b|\bchile\b/, "CL"],
  [/\bfrom canada\b|\bcanada\b/, "CA"],
  [/\bfrom australia\b|\baustralia\b/, "AU"],
  [/\bfrom new zealand\b|\bnew zealand\b/, "NZ"],
  [/\bfrom israel\b|\bisrael\b/, "IL"],
  [/\bfrom egypt\b|\begypt\b/, "EG"],
  [/\bfrom morocco\b|\bmorocco\b/, "MA"],
  [/\bfrom cuba\b|\bcuba\b/, "CU"],
  [/\bfrom jamaica\b|\bjamaica\b/, "JM"],
];

// Spotify genre keywords → hint at likely region/country codes
const GENRE_COUNTRY_HINTS: Array<{ keywords: string[]; countries: string[] }> = [
  { keywords: ["k-pop", "kpop", "korean", "k pop"], countries: ["KR"] },
  { keywords: ["j-pop", "jpop", "j-rock", "anime", "shibuya-kei", "city pop"], countries: ["JP"] },
  { keywords: ["c-pop", "cpop", "mandopop", "mandarin pop"], countries: ["CN", "TW", "HK"] },
  { keywords: ["cantopop", "canto"], countries: ["HK"] },
  { keywords: ["latin", "reggaeton", "latin pop", "latin trap", "perreo", "cumbia", "salsa", "bachata", "merengue", "dembow", "urbano latino", "pop en espanol", "pop en español", "colombian", "mexican pop", "bolero"], countries: ["MX", "CO", "AR", "ES", "CL", "PR", "CU", "DO", "VE", "PE", "EC"] },
  { keywords: ["spanish pop", "flamenco", "pop español", "spain"], countries: ["ES"] },
  { keywords: ["french pop", "chanson", "variété", "musique française"], countries: ["FR"] },
  { keywords: ["deutschpop", "schlager", "german", "neue deutsche welle"], countries: ["DE", "AT", "CH"] },
  { keywords: ["afrobeats", "afropop", "afro pop", "highlife", "afroswing", "jùjú"], countries: ["NG", "GH"] },
  { keywords: ["amapiano", "kwaito", "gqom"], countries: ["ZA"] },
  { keywords: ["mande", "coupe decale", "afrobeats"], countries: ["CI", "SN"] },
  { keywords: ["turkish pop", "turk pop", "arabesk"], countries: ["TR"] },
  { keywords: ["hindi", "bollywood", "punjabi", "desi", "filmi"], countries: ["IN"] },
  { keywords: ["albanian pop", "albanian"], countries: ["AL"] },
  { keywords: ["brazilian", "sertanejo", "pagode", "axé", "forró", "bossa nova", "mpb", "funk carioca", "baile funk", "trap funk"], countries: ["BR"] },
  { keywords: ["swedish pop", "swedish", "scandipop"], countries: ["SE"] },
  { keywords: ["arabic pop", "khaleeji", "sha\'bi"], countries: ["SA", "EG", "LB", "MA"] },
  { keywords: ["balkan"], countries: ["RS", "HR", "BA", "ME", "AL", "MK", "BG"] },
  { keywords: ["romanian pop", "manele"], countries: ["RO"] },
].filter(Boolean) as Array<{ keywords: string[]; countries: string[] }>;

/** Return likely country codes based on Spotify genre tags */
function getCountryHintsFromGenres(genres: string[]): string[] {
  if (!genres.length) return [];
  const normalized = genres.map((g) => g.toLowerCase());
  const hints = new Set<string>();
  for (const { keywords, countries } of GENRE_COUNTRY_HINTS) {
    if (keywords.some((kw) => normalized.some((g) => g.includes(kw)))) {
      countries.forEach((c) => hints.add(c));
    }
  }
  return Array.from(hints);
}

// Rate limiter: max 1 request per second
let lastRequestTime = 0;

/** Extract genre tags from a MusicBrainz artist result, sorted by vote count */
function extractTags(artist: { tags?: { name: string; count: number }[] }): string[] {
  if (!artist.tags || !Array.isArray(artist.tags)) return [];
  return artist.tags
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((t) => t.name);
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1100) {
    await new Promise((resolve) =>
      setTimeout(resolve, 1100 - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
}

export interface MusicBrainzArtistResult {
  mbid: string | null;
  name: string;
  countryCode: string | null;
  areaName: string | null;
  genres: string[];
}

export async function searchArtist(
  artistName: string,
  genres?: string[]
): Promise<MusicBrainzArtistResult | null> {
  try {
    const encodedName = encodeURIComponent(artistName);
    const res = await rateLimitedFetch(
      `${MUSICBRAINZ_BASE}/artist/?query=artist:${encodedName}&fmt=json&limit=5&inc=tags`
    );

    if (!res.ok) {
      console.error(`MusicBrainz search failed for "${artistName}": ${res.status}`);
      return await searchWikidataArtist(artistName, genres);
    }

    const data = await res.json();
    const artists = data.artists;
    if (!artists || artists.length === 0) {
      return await searchWikidataArtist(artistName, genres);
    }

    // Genre hints help pick the right artist when names collide (e.g. "Melody" could be Spanish or Japanese)
    const genreHints = getCountryHintsFromGenres(genres ?? []);

    // Prefer: exact name + country matches genre hint → exact name (any country) → first result
    const exactMatches = artists.filter(
      (a: { name: string }) => a.name.toLowerCase() === artistName.toLowerCase()
    );
    const pool = exactMatches.length > 0 ? exactMatches : artists;

    let best: { id: string; name: string; country?: string; tags?: { name: string; count: number }[]; area?: { type: string; name: string; "iso-3166-1-codes"?: string[] }; begin_area?: { type: string; name: string; "iso-3166-1-codes"?: string[] } };
    if (genreHints.length > 0) {
      const hintedMatch = pool.find((a: typeof pool[0]) => {
        const cc = a.country || extractCountryFromArea(a.area) || extractCountryFromArea(a.begin_area);
        return cc && genreHints.includes(cc);
      });
      best = hintedMatch || pool[0];
    } else {
      best = pool[0];
    }

    const mbGenres = extractTags(best);
    let countryCode = best.country || extractCountryFromArea(best.area) || extractCountryFromArea(best.begin_area);
    let areaName = best.area?.name || best.begin_area?.name || null;

    if (!countryCode && best.id) {
      const details = await getArtistDetails(best.id);
      countryCode = details.countryCode;
      areaName = details.areaName || areaName;
    }

    if (!countryCode) {
      const fallback = await searchWikidataArtist(artistName, genres);
      if (fallback?.countryCode) {
        return {
          mbid: best.id,
          name: best.name,
          countryCode: fallback.countryCode,
          areaName: fallback.areaName || areaName,
          genres: mbGenres,
        };
      }
    }

    return {
      mbid: best.id,
      name: best.name,
      countryCode,
      areaName,
      genres: mbGenres,
    };
  } catch (error) {
    console.error(`MusicBrainz lookup threw for "${artistName}":`, error);
    return await searchWikidataArtist(artistName, genres);
  }
}

function extractCountryFromArea(
  area: { type: string; name: string; "iso-3166-1-codes"?: string[] } | undefined
): string | null {
  if (!area) return null;
  if (area["iso-3166-1-codes"]?.length) {
    return area["iso-3166-1-codes"][0];
  }
  return null;
}

export async function getArtistDetails(
  mbid: string
): Promise<{ countryCode: string | null; areaName: string | null }> {
  const res = await rateLimitedFetch(
    `${MUSICBRAINZ_BASE}/artist/${mbid}?inc=&fmt=json`
  );

  if (!res.ok) {
    console.error(`MusicBrainz lookup failed for MBID ${mbid}: ${res.status}`);
    return { countryCode: null, areaName: null };
  }

  const data = await res.json();
  return {
    countryCode: data.country || extractCountryFromArea(data.area),
    areaName: data.area?.name || null,
  };
}

async function searchWikidataArtist(
  artistName: string,
  genres?: string[]
): Promise<MusicBrainzArtistResult | null> {
  try {
    const params = new URLSearchParams({
      action: "wbsearchentities",
      search: artistName,
      language: "en",
      format: "json",
      limit: "5",
    });

    const res = await fetch(`${WIKIDATA_SEARCH_BASE}?${params}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`Wikidata search failed for "${artistName}": ${res.status}`);
      return null;
    }

    const data = await res.json();
    const results = Array.isArray(data.search) ? data.search : [];
    if (results.length === 0) return null;

    const exactMatch = results.find(
      (entry: { label?: string }) =>
        entry.label?.toLowerCase() === artistName.toLowerCase()
    );
    const best = exactMatch || results.find(isLikelyArtistResult) || results[0];
    const description = String(best.description || "");

    // Try genre hints first — often more reliable than parsing Wikidata description text
    const genreCountry = genres?.length ? getCountryHintsFromGenres(genres)[0] ?? null : null;

    return {
      mbid: null,
      name: String(best.label || artistName),
      countryCode: genreCountry || inferCountryCodeFromDescription(description),
      areaName: description || null,
      genres: [],
    };
  } catch (error) {
    console.error(`Wikidata lookup failed for "${artistName}":`, error);
    return null;
  }
}

function isLikelyArtistResult(entry: { description?: string }) {
  const description = String(entry.description || "").toLowerCase();
  return ![
    "discography",
    "album",
    "song",
    "single",
    "wikimedia",
    "list of",
  ].some((term) => description.includes(term));
}

function inferCountryCodeFromDescription(description: string): string | null {
  const normalized = description.toLowerCase();

  // Try nationality adjectives first (more specific)
  for (const [nationality, iso] of Object.entries(NATIONALITY_TO_ISO)) {
    if (normalized.includes(nationality)) {
      return iso;
    }
  }

  // Try country name phrases (e.g. "from Austria", "duo from Albania")
  for (const [pattern, iso] of COUNTRY_NAME_TO_ISO) {
    if (pattern.test(normalized)) {
      return iso;
    }
  }

  return null;
}
