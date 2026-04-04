I’m going to give you a practical debugging playbook for this exact app stack, focused on what breaks most often in Next.js + React + TypeScript + Spotify OAuth + Turso, and how to isolate root causes quickly instead of guessing. I’ll keep it hands-on so you can build confidence fixing issues yourself.**Debug Mindset**
You do not need to know everything. You need a reliable loop:

1. Reproduce consistently.
2. Narrow to one layer.
3. Form one hypothesis.
4. Run one check to confirm or kill it.
5. Make one small fix.
6. Re-test and verify no regression.

Most people get stuck because they skip step 2 and change too many things.

**Know Your Layers**
For this project, think in 5 layers:

1. UI layer: React components and state.
2. App/API layer: Next.js route handlers.
3. External APIs: Spotify and MusicBrainz.
4. Data layer: Turso queries and schema.
5. Config/runtime: env vars, cookies, auth flow, deployment differences.

When something breaks, first ask: which layer is most likely?

**What Breaks Most Often In Your Stack**

1. Environment variable mistakes
- Symptom: login fails, 500 on auth route, undefined URL/client id.
- Likely cause: missing or misspelled env var, wrong callback URL.
- Check: compare values used in spotify.ts, session.ts, and auth routes under auth.
- Fix pattern: validate required env vars at startup and fail early with clear message.

2. OAuth/session issues
- Symptom: infinite redirect to login, logged out after refresh, 401 from Spotify routes.
- Likely cause: refresh token not stored/read correctly, cookie flags wrong, token expiration handling bug.
- Check: inspect /api/auth and /api/spotify responses in Network tab, watch Set-Cookie and status codes.
- Fix pattern: log token expiry timestamp and refresh attempts in server logs, verify callback route logic in route.ts.

3. React client/server boundary bugs
- Symptom: hydration warnings, component works after refresh but not first load, window is not defined.
- Likely cause: browser-only code running during server render.
- Check: components that touch window/document or globe libs in Globe.tsx and GlobeView.tsx.
- Fix pattern: move browser-only logic to useEffect or dynamic import with SSR disabled for heavy client components.

4. TypeScript silent shape mismatches
- Symptom: runtime undefined errors even though compile passes.
- Likely cause: API response type assumed, not validated.
- Check: boundaries where external JSON enters system in route.ts, route.ts, aggregation.ts.
- Fix pattern: runtime validation (for example schema validation) at boundaries, then map to internal types.

5. Turso/data bugs
- Symptom: empty results, duplicate cache entries, inconsistent country mapping.
- Likely cause: wrong SQL, schema drift, case sensitivity, null handling.
- Check: query inputs and returned rows in db.ts.
- Fix pattern: log query params and row counts; add unique constraints for keys like spotify artist id; handle null country as explicit Unknown bucket.

6. Rate limiting and external API failures
- Symptom: random 429, slow loading, partial data.
- Likely cause: MusicBrainz 1 req/sec limit, no retries/backoff.
- Check: error frequency and response headers in musicbrainz.ts.
- Fix pattern: queue requests, exponential backoff, cache aggressively, return partial results with progress info instead of hard fail.

7. Data aggregation logic bugs
- Symptom: globe colors look wrong, counts do not match UI cards.
- Likely cause: mismatched grouping logic, duplicate artists across time windows, bad normalization.
- Check: pure functions in aggregation.ts with small deterministic test inputs.
- Fix pattern: unit test aggregation with known fixtures and expected country totals.

**How To Identify Issues Faster**
Use this quick triage table:

1. Build fails before app starts
- Category: TypeScript/import/config.
- First stop: compiler error line, then file directly.

2. Page loads but component crashes
- Category: client runtime/state.
- First stop: browser console stack trace and component props.

3. API call returns 401/403
- Category: auth/session/scopes.
- First stop: auth route logs, token expiry, granted scopes.

4. API call returns 429/5xx
- Category: upstream limits/outage.
- First stop: retry/backoff behavior and fallback UX.

5. Data shows but is wrong
- Category: mapping/aggregation/DB logic.
- First stop: inspect raw input vs transformed output side by side.

**Confidence-Building Workflow (Use This Weekly)**

1. Keep a short bug log
- For each issue, write: symptom, root cause, fix, prevention.
- After 10 issues, patterns repeat and debugging gets much easier.

2. Add targeted diagnostics, not noisy logs
- Log request id, user id hash, route, upstream status, duration.
- Avoid dumping huge payloads except when isolating one bug.

3. Create tiny reproducible test data
- For aggregation and mapping, keep a few known artist/country fixtures.
- Test pure logic in isolation before UI.

4. Verify in this order
- Local dev.
- Production-like build.
- One realistic user flow end-to-end (login → top items → country modal → playlist create).

5. Treat every fix as two tasks
- Task A: remove the bug.
- Task B: add a guard so same class of bug is caught earlier next time (type guard, runtime validation, test, better error message).

**Minimal Debug Checklist For Any New Bug**

1. What exact action triggers it?
2. Is it client, API route, external API, DB, or config?
3. What are the exact status codes and error messages?
4. What changed recently?
5. Can I reproduce with smallest input?
6. Did my fix change behavior elsewhere?

If you can answer these six consistently, you are no longer vibe coding.

**Project-Specific Places To Inspect First**
- Auth/session flow: route.ts, route.ts, route.ts, session.ts, auth-helpers.ts
- Spotify calls: spotify.ts, route.ts
- MusicBrainz + cache: musicbrainz.ts, route.ts, db.ts
- Data transformation: aggregation.ts
- Globe rendering and interaction: Globe.tsx, CountryModal.tsx, page.tsx

If you want, I can do a second pass where I give you a concrete “if this error message appears, do these exact 3 checks” cheat sheet tailored to your current codebase.