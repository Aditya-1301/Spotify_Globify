import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let initializationPromise: Promise<void> | null = null;

export async function initializeDatabase() {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS artists (
        spotify_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        country_code TEXT,
        language TEXT,
        genres TEXT,
        musicbrainz_id TEXT,
        image_url TEXT,
        last_updated INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS user_discoveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        country_code TEXT NOT NULL,
        first_discovered_at INTEGER NOT NULL DEFAULT (unixepoch()),
        first_artist_name TEXT,
        UNIQUE(user_id, country_code)
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_artists_country ON artists(country_code)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_discoveries_user ON user_discoveries(user_id)`,
      args: [],
    },
  ]);
}

async function ensureDatabaseInitialized() {
  if (!initializationPromise) {
    initializationPromise = initializeDatabase().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

export interface CachedArtist {
  spotify_id: string;
  name: string;
  country_code: string | null;
  language: string | null;
  genres: string | null;
  musicbrainz_id: string | null;
  image_url: string | null;
  last_updated: number;
}

export async function getCachedArtists(
  spotifyIds: string[]
): Promise<Map<string, CachedArtist>> {
  await ensureDatabaseInitialized();

  if (spotifyIds.length === 0) return new Map();

  const placeholders = spotifyIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT * FROM artists WHERE spotify_id IN (${placeholders})
          AND country_code IS NOT NULL
          AND last_updated > unixepoch() - 604800`,
    args: spotifyIds,
  });

  const map = new Map<string, CachedArtist>();
  for (const row of result.rows) {
    map.set(row.spotify_id as string, {
      spotify_id: row.spotify_id as string,
      name: row.name as string,
      country_code: row.country_code as string | null,
      language: row.language as string | null,
      genres: row.genres as string | null,
      musicbrainz_id: row.musicbrainz_id as string | null,
      image_url: row.image_url as string | null,
      last_updated: row.last_updated as number,
    });
  }
  return map;
}

export async function upsertArtist(artist: {
  spotify_id: string;
  name: string;
  country_code: string | null;
  language: string | null;
  genres: string | null;
  musicbrainz_id: string | null;
  image_url: string | null;
}) {
  await ensureDatabaseInitialized();

  await db.execute({
    sql: `INSERT INTO artists (spotify_id, name, country_code, language, genres, musicbrainz_id, image_url, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
          ON CONFLICT(spotify_id) DO UPDATE SET
            country_code = COALESCE(excluded.country_code, artists.country_code),
            language = COALESCE(excluded.language, artists.language),
            genres = CASE WHEN excluded.genres IS NOT NULL AND excluded.genres != '' THEN excluded.genres ELSE artists.genres END,
            musicbrainz_id = COALESCE(excluded.musicbrainz_id, artists.musicbrainz_id),
            image_url = CASE WHEN excluded.image_url IS NOT NULL THEN excluded.image_url ELSE artists.image_url END,
            name = CASE WHEN excluded.name IS NOT NULL AND excluded.name != '' THEN excluded.name ELSE artists.name END,
            last_updated = unixepoch()`,
    args: [
      artist.spotify_id,
      artist.name,
      artist.country_code,
      artist.language,
      artist.genres,
      artist.musicbrainz_id,
      artist.image_url,
    ],
  });
}

export async function recordDiscovery(
  userId: string,
  countryCode: string,
  artistName: string
) {
  await ensureDatabaseInitialized();

  await db.execute({
    sql: `INSERT OR IGNORE INTO user_discoveries (user_id, country_code, first_artist_name)
          VALUES (?, ?, ?)`,
    args: [userId, countryCode, artistName],
  });
}

export async function getUserDiscoveries(userId: string) {
  await ensureDatabaseInitialized();

  const result = await db.execute({
    sql: `SELECT country_code, first_discovered_at, first_artist_name
          FROM user_discoveries WHERE user_id = ? ORDER BY first_discovered_at DESC`,
    args: [userId],
  });
  return result.rows;
}

export default db;
