# Plan: Spotify Globify — Interactive Music Globe

## TL;DR
Build a Next.js web app where users authenticate via Spotify, see an interactive 3D globe (react-globe.gl) with countries shaded by listening density, click countries to explore top artists/songs from that region, get recommendations filtered by language/genre, auto-create playlists, and view detailed analytics below the globe. Artist-to-country mapping uses MusicBrainz API with SQLite caching. Support Spotify data export upload for deep analytics (minutes listened, historical Wrapped-like data).

## Feasibility & Existing Landscape
- **Viable**: Yes. All core APIs exist and are free/non-commercial.
- **No direct competitor** does exactly this. Receiptify, Stats for Spotify, Obscurify, and Spotify Pie exist but none combine a 3D globe + country mapping + recommendations + playlist creation.
- **Key constraint**: Spotify API does NOT provide artist nationality or song language. MusicBrainz API fills this gap (provides artist area/country and recording language). MusicBrainz is rate-limited to 1 request/second — caching in SQLite is essential.
- **Spotify Recommendations API** is marked "Deprecated" but still functional as of April 2026. Seeds: up to 5 combined artist/genre/track seeds. Can filter by market (country).
- **Spotify Wrapped historical data**: Not accessible via API. But users can request their full streaming history from spotify.com/account (JSON download). We can parse this for minutes listened, historical trends, etc.

## Tech Stack (Confirmed)
- **Framework**: Next.js 14+ (App Router) with React, TypeScript
- **3D Globe**: `react-globe.gl` (ThreeJS-based, supports choropleth polygons with click events, 83K weekly npm downloads)
- **Auth**: Spotify OAuth 2.0 Authorization Code Flow with PKCE (via NextAuth.js or custom)
- **Database**: Turso (LibSQL — hosted SQLite-compatible) — free tier: 9GB storage, 25M row reads/month. SDK: `@libsql/client`. Replaces `better-sqlite3` since Vercel serverless has ephemeral file systems.
- **Styling**: Tailwind CSS with CSS custom properties for dynamic theming
- **Charts**: Recharts (for analytics section)
- **Embeds**: Spotify iFrame Embed API for song previews
- **Image Generation**: Next.js OG Image API (Satori) + html2canvas for shareable visa images
- **Deployment**: Vercel Hobby (free) — see Hosting Strategy below
- **External APIs**: Spotify Web API, MusicBrainz API, GeoJSON country data (Natural Earth)

## Hosting Strategy
**Primary: Vercel Hobby (Free) + Turso Free**
- Vercel Hobby: 1M function invocations/month, 100 deployments/day, 10s function timeout. If limits are hit, site pauses — no surprise bills.
- Turso Free: 9GB storage, 25M row reads/month — more than enough for artist cache + user discovery data
- DDoS/WAF protection included free on Vercel
- Total monthly cost: $0

**If it grows:**
- Vercel Pro ($20/mo): 10M edge requests, 300s function timeout, team features. Turso free tier likely still sufficient.
- Monetization path: donation button (Buy Me a Coffee / GitHub Sponsors) or non-intrusive sponsorships

**Migration path (easy — Next.js is portable):**
- Self-host: `next build && next start` on any VPS (e.g., Oracle Cloud Always-Free ARM VM: 4 OCPUs, 24GB RAM, genuinely free forever)
- Cloudflare Pages: unlimited bandwidth, 100K worker requests/day free. Use `@cloudflare/next-on-pages` adapter + Cloudflare D1 (SQLite, 5M reads/day free)
- No vendor lock-in: Turso can be swapped for local SQLite (`better-sqlite3`) on any VPS, or Cloudflare D1

## Security Hardening
- **OAuth**: PKCE flow (no client_secret on client side). Tokens stored in HTTP-only, Secure, SameSite=Strict cookies. Token refresh handled server-side.
- **API routes**: All Spotify API calls proxied through server — access/refresh tokens never exposed to browser JavaScript
- **Input validation**: Strict JSON schema validation on data export upload endpoint (max file size, expected shape). Reject malformed input.
- **Rate limiting**: Apply rate limiting on API routes (e.g., Vercel Edge Middleware or `next-rate-limit`) to prevent abuse
- **Headers**: CSP (Content-Security-Policy) allowing Spotify embed iframes. X-Content-Type-Options, X-Frame-Options on own pages. CORS restricted to own domain.
- **Data privacy**: Only public artist metadata cached in Turso. No user listening data stored server-side (computed on-the-fly per session, or stored client-side in localStorage for returning visits). Data export files processed in-memory, never persisted.
- **Dependencies**: Keep dependencies minimal. Audit with `npm audit` regularly.

## Spotify API Scopes Needed
- `user-read-private` — user profile & country
- `user-top-read` — top artists & tracks (short/medium/long term)
- `user-read-recently-played` — last 50 recently played
- `playlist-modify-public` — create playlists
- `playlist-modify-private` — create private playlists

## Architecture Overview

```
User Browser
  ├─ Next.js Frontend (React)
  │   ├─ Landing/Auth Page
  │   ├─ Globe View (react-globe.gl)
  │   ├─ Country Detail Modal
  │   ├─ Recommendations Page
  │   └─ Analytics Dashboard (below globe)
  ├─ Next.js API Routes
  │   ├─ /api/auth/* (Spotify OAuth)
  │   ├─ /api/spotify/* (proxy to Spotify API)
  │   ├─ /api/artists/countries (batch resolve via MusicBrainz + cache)
  │   ├─ /api/recommendations
  │   ├─ /api/playlists/create
  │   └─ /api/upload (Spotify data export parser)
  └─ SQLite DB (artist_id → country, language, MusicBrainz metadata cache)
```

---

## Steps

### Phase 1: Project Setup & Auth
1. Initialize Next.js project with TypeScript, Tailwind CSS, ESLint
2. Set up Spotify OAuth flow (Authorization Code with PKCE) — login page, callback handler, token refresh logic, session management via cookies/JWT
3. Create landing page with Spotify login button (dark, bold aesthetic inspired by WisprFlow/Anthropic — large typography, saturated accent colors)
4. Set up Turso database schema: `artists` table (spotify_id, name, country_code, language, genres, musicbrainz_id, last_updated), `user_discoveries` table (user_id, country_code, first_discovered_at, first_artist_name) for Music Passport feature

### Phase 2: Data Pipeline — Artist-to-Country Resolution
5. Build Spotify API client wrapper: fetch user's top artists (short/medium/long term, up to 50 each), top tracks, recently played
6. Build MusicBrainz lookup service: search artist by name → get MBID → lookup artist area/country. Implement rate limiting (1 req/sec) and Turso caching — *depends on step 4*
7. Create `/api/artists/countries` endpoint: takes array of Spotify artist IDs, returns cached country mappings, queues uncached artists for MusicBrainz resolution — *depends on steps 5, 6*
8. Build data aggregation logic: for each user, compute country → { artistCount, trackCount, topArtists[], genres[], languages[] }. Handle edge cases (artists with no country, multi-national groups)

### Phase 3: Interactive 3D Globe
9. Integrate `react-globe.gl` with GeoJSON country polygons (Natural Earth 110m data). Use `polygonsData` layer with `onPolygonClick` for country interaction — *depends on step 8*
10. Implement choropleth coloring: gradient from low (cool/muted) to high (bold/saturated) based on normalized listening density per country. Use the dominant country's palette as the site-wide accent color
11. Add hover tooltips showing country name + quick stats (artist count, top artist name)
12. Implement globe auto-rotation, smooth camera transitions when clicking countries

### Phase 4: Country Detail Modal
13. Build modal/drawer component that appears on country click: show country flag, top 3 artists with images, primary language of music, genre breakdown, most-listened song per artist with Spotify embed — *depends on steps 9, 8*
14. Add Spotify iFrame embeds for song previews (use Spotify Embed API: `<iframe src="https://open.spotify.com/embed/track/{id}">`)
15. Add "See Recommendations" link that navigates to the recommendations page for this country's artists/genres

### Phase 5: Recommendations & Playlist Creation
16. Build recommendations page: use Spotify Recommendations API (`GET /recommendations`) seeded by top artists from selected country. Show results as filterable card grid — *depends on step 13*
17. Implement filters: genre dropdown (from available genre seeds), language filter (derived from MusicBrainz data), popularity range slider
18. Add Spotify embeds for each recommended track
19. Build "Create Playlist" feature: POST to Spotify Create Playlist API, then add recommended tracks. Show success confirmation with link to new playlist on Spotify — *depends on step 16*

### Phase 6: Dynamic Theming
20. Implement dynamic color system using CSS custom properties: extract dominant color from top country or clicked country, generate accessible color palette (ensure WCAG AA contrast ratios). Use Tailwind's `theme()` with CSS variables — *parallel with steps 9-19*
21. Smooth color transitions when switching countries (CSS transitions on custom properties)

### Phase 7: Analytics Dashboard (Below Globe)
22. Build scrollable analytics section below the globe: — *depends on step 8*
    - "Your World in Music" summary stats (countries listened, total artists, dominant language)
    - Country breakdown bar chart (Recharts) — countries ranked by listening
    - Language distribution pie/donut chart
    - Genre distribution across countries (stacked bar or treemap)
    - Timeline view if data export is uploaded (monthly listening by country over time)
23. Add smooth scroll-triggered animations (Framer Motion or CSS `@starting-style`)

### Phase 8: Spotify Data Export Upload
24. Build `/api/upload` endpoint: accept and parse Spotify extended streaming history JSON (array of play events with `ts`, `ms_played`, `master_metadata_track_name`, `master_metadata_album_artist_name`, `spotify_track_uri`) — *parallel with other phases*
25. Process uploaded data: aggregate minutes listened per artist, compute historical trends, merge with API data for enriched analytics
26. Update globe + analytics to reflect uploaded data (actual minutes listened instead of API ranking approximations)

### Phase 9: Polish & Performance
27. Add loading states, skeleton screens, error boundaries
28. Optimize MusicBrainz resolution: batch process in background, show "resolving X artists..." progress indicator
29. Responsive design: collapse globe to 2D map or smaller viewport on mobile, stack analytics vertically
30. SEO & meta tags for the landing page

### Phase 10: Music Passport (Gamification)
31. Create passport UI: a "passport book" component showing all countries a user has discovered music from, with stamps (country flags + discovery date + first artist)
32. Detection logic: compare user's current country data against `user_discoveries` table in Turso. When a country appears that wasn't there before, trigger a "new stamp" animation — *depends on steps 4, 8*
33. Passport summary stats: total countries discovered, discovery streak, "most recent stamp", percentage of world explored
34. Add passport link/icon on the globe page

### Phase 11: Genre Bridge Recommendations
35. Map user's top genres to equivalent genres in target country using Spotify's genre seed list + MusicBrainz tags. E.g., user listens to "hip-hop" → seed recommendations with "hip-hop" + target country as market parameter — *enhancement to step 16*
36. UI: show the "bridge" on recommendation cards — "Because you like US Hip-Hop → French Rap" with source and target genre chips
37. Use MusicBrainz tag relationships to find genre translations (e.g., "bollywood" ↔ "hindi film music", "reggaeton" ↔ "latin urban")

### Phase 12: Time Machine Slider
38. Add a timeline slider component at the bottom of the globe page. Only available when data export is uploaded — *depends on steps 24-26*
39. Parse timestamps from streaming history, group plays by configurable time periods (monthly, quarterly, yearly)
40. Animate globe transitions as slider moves: choropleth colors update smoothly, camera can optionally auto-focus on the "rising" country for each period
41. Show a sparkline below the slider showing total listening volume over time

### Phase 13: Shareable Listening Visa
42. "Listening Visa" generator: produce a shareable image card for any country. Contains: country flag, top 3 artists (with images), dominant genre, total time listened, mini globe thumbnail — *depends on steps 8, 13*
43. Use Next.js OG Image generation (Satori/`ImageResponse`) for server-side image rendering at `/api/visa/[country].png`
44. Client-side: "Share" button on country modal → generates image → options to download PNG, copy to clipboard, or share via Web Share API (mobile)
45. Also generate a "Global Visa" — overall stats card showing all countries, total artists, top genres, listening world coverage percentage

## Relevant Files (to be created)
- `src/app/page.tsx` — Landing page with login
- `src/app/globe/page.tsx` — Main globe view + analytics
- `src/app/recommendations/page.tsx` — Recommendations & playlist creation
- `src/app/passport/page.tsx` — Music Passport page (country stamps, stats)
- `src/app/api/auth/[...spotify]/route.ts` — Spotify OAuth handlers
- `src/app/api/spotify/top-items/route.ts` — Proxy to Spotify top items
- `src/app/api/artists/countries/route.ts` — MusicBrainz batch resolution
- `src/app/api/recommendations/route.ts` — Spotify recommendations proxy (with genre bridge logic)
- `src/app/api/playlists/create/route.ts` — Playlist creation
- `src/app/api/upload/route.ts` — Data export parser
- `src/app/api/visa/[country]/route.ts` — OG image generation for shareable visa
- `src/lib/spotify.ts` — Spotify API client (auth, fetch top items, recommendations, playlists)
- `src/lib/musicbrainz.ts` — MusicBrainz API client with rate limiter
- `src/lib/db.ts` — Turso/LibSQL connection + queries (artist cache, user discoveries)
- `src/lib/aggregation.ts` — Data aggregation (country → artists/stats)
- `src/lib/theme.ts` — Dynamic color palette generation
- `src/lib/genre-bridge.ts` — Genre mapping/translation logic for bridge recommendations
- `src/lib/visa-generator.ts` — Shareable image generation helpers
- `src/components/Globe.tsx` — react-globe.gl wrapper
- `src/components/CountryModal.tsx` — Country detail modal (with share button)
- `src/components/SpotifyEmbed.tsx` — Spotify iFrame embed wrapper
- `src/components/Analytics.tsx` — Charts and analytics section
- `src/components/RecommendationCard.tsx` — Recommendation result card (with genre bridge chips)
- `src/components/Passport.tsx` — Music passport UI (stamps, stats)
- `src/components/TimeSlider.tsx` — Time machine slider for historical data
- `src/components/VisaCard.tsx` — Listening visa preview card
- `src/data/countries.geojson` — GeoJSON country polygons
- `src/data/genre-map.json` — Genre translation/equivalence mappings

## Verification
1. **Auth flow**: Login via Spotify, verify token storage, test token refresh after expiry
2. **Artist resolution**: Verify MusicBrainz lookup correctness for 10+ known artists (e.g., BTS → South Korea, Adele → UK, Bad Bunny → Puerto Rico). Check SQLite cache hit/miss behavior
3. **Globe rendering**: Load globe with test data, verify choropleth colors update, click a country and verify modal shows correct data
4. **Embeds**: Verify Spotify iFrame embeds load and play 30-second previews
5. **Recommendations**: Seed with known artists, verify results return and filters work
6. **Playlist creation**: Create a test playlist, verify it appears in user's Spotify account
7. **Data upload**: Upload a sample Spotify data export JSON, verify minutes-listened calculations
8. **Theming**: Click different countries, verify color palette transitions and contrast ratios
9. **Responsive**: Test on mobile viewport (375px), tablet (768px), desktop (1440px)
10. **Run `next build`** to verify no TypeScript/build errors

## Decisions
- **Artist-to-country mapping via MusicBrainz**: Spotify has no nationality field. MusicBrainz `artist.area` is the best available source. Some artists may not have country data — these are grouped under "Unknown".
- **Language detection**: Primarily from MusicBrainz recording metadata. Fallback: infer from artist country (e.g., artists from Japan → Japanese). Not perfect but practical.
- **Spotify Recommendations API deprecated**: Still functional as of 2026. If discontinued, fallback to building recommendations from MusicBrainz related-artist data + Spotify search by genre/market.
- **No Spotify Wrapped API access**: Historical data only available via user-uploaded data export. This is an opt-in feature.
- **SQLite chosen over hosted DB**: ~~Simpler, no external dependency, suitable for single-instance deployment.~~ REVISED: Using Turso (hosted LibSQL/SQLite-compatible) because Vercel serverless has ephemeral file systems — local SQLite would lose data between invocations. Turso free tier is generous (9GB, 25M reads/month). If self-hosting later, swap to local `better-sqlite3` with identical queries.
- **Scope exclusions**: No real-time playback tracking, no mobile app (web-only). Friend comparison deferred to later phase.
- **Hosting**: Start on Vercel Hobby ($0). Migrate to Vercel Pro ($20/mo) or self-host (Oracle Cloud free VPS, or Cloudflare Pages) if needed. Next.js is fully portable.
- **UI inspiration**: Dark mode base (Linear-style negative space + typography), saturated dynamic gradients (Stripe globe-style), playful color accents (Amie-style), data storytelling layout (The Pudding-style). Extract dominant color from album art (Spotify's own technique) for dynamic CSS variables.

## Further Considerations
1. **MusicBrainz cold-start**: First-time users with many unique artists will experience slow resolution (~1 artist/second). Consider: (A) pre-populate cache with top 10K Spotify artists, (B) show progressive loading, or (C) use a secondary data source like Wikidata SPARQL for faster bulk lookups. **Recommendation: B + A combined.**
2. **Spotify API quotas**: Development mode allows 25 users. To go public, you need to submit for Spotify's Extended Quota Mode review. Plan for this before public launch.
3. **Puerto Rico / disputed territories**: Some artists come from territories that aren't standard ISO countries. Decide whether to map PR → US or show separately. **Recommendation: Show separately for better granularity.**

---

## Phase 14 (Stretch): Sub-national Language Granularity
For countries like India with multiple state-specific languages:
- Use **language as primary sub-grouping** within a country (e.g., clicking India → breakdown by Hindi, Tamil, Telugu, Punjabi, etc.)
- When MusicBrainz provides sub-national area (e.g., Chennai → Tamil Nadu → India), use it for state-level mapping
- Add "zoom into country" feature: clicking a country with multi-language data shows state-level choropleth using GADM/Natural Earth admin-1 GeoJSON
- Genre tags also help (e.g., "Bollywood" → Hindi, "Tamil film music" → Tamil, "Tollywood" → Telugu)
- Many artists only tagged as "India" — language is more reliable than state for grouping

## Phase 15 (Stretch): Multi-Platform Support

### Apple Music (Viable — full API support)
- Apple Music API provides: History endpoint, Replay Data, full library access, recommendations, playlist creation
- Auth: MusicKit JS for web, requires Apple Developer account ($99/year)
- Artist-to-country mapping: same MusicBrainz pipeline (search by artist name)
- Add as second platform after Spotify core is solid
- New files: `src/lib/applemusic.ts`, `src/app/api/auth/apple/route.ts`
- UI: platform selector on login page, platform badge on data cards

### YouTube Music (Data export only — no listening API)
- YouTube Data API v3 has NO music listening history, no music library, no recommendations for music
- **Workaround**: Support Google Takeout "YouTube and YouTube Music" data export upload
- Parse watch-history.json / MyActivity.json for music video plays
- Map video titles to artists via MusicBrainz search

### SoundCloud (Data export only — very limited API)
- SoundCloud API has OAuth + likes/playlists but NO listening history or play counts
- **Workaround**: Support SoundCloud data request export upload
- Can supplement with likes data from API (tracks the user has liked)

### Architecture for multi-platform:
- Abstract `MusicPlatformClient` interface: `getTopArtists()`, `getRecentlyPlayed()`, `getRecommendations()`, `createPlaylist()`
- Platform-specific implementations: `SpotifyClient`, `AppleMusicClient`
- Data upload parsers: `SpotifyExportParser`, `GoogleTakeoutParser`, `SoundCloudExportParser`
- Aggregation layer merges data from all connected platforms before rendering globe

## Phase 16 (Stretch): Friend Comparison
- Allow users to generate a shareable "globe link" that encodes their aggregated country data
- Another user can load that link and overlay both globes side-by-side or merged
- Requires storing aggregated user data in Turso (add `user_globe_data` table with user_id, country_json, generated_at)
- Comparison view: split-screen globes or single globe with two-tone coloring (user A vs user B)
- Show "taste overlap" stats: shared countries, shared artists, unique discoveries per user
