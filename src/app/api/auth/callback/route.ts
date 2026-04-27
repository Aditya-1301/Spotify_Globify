import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/spotify";
import { createSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const storedState = request.cookies.get("oauth_state")?.value;
  const codeVerifier = request.cookies.get("pkce_verifier")?.value;

  // Fall back to the request's own origin — this is safe on Vercel because
  // the request always arrives at the correct deployment URL, even for previews.
  // Only override via NEXT_PUBLIC_APP_URL if you need a canonical domain.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ||
    process.env.NEXT_PUBLIC_REDIRECT_URI ||
    `${request.nextUrl.origin}/api/auth/callback`;

  // Diagnostic logging
  console.log("[auth/callback] === AUTH CALLBACK DEBUG ===");
  console.log("[auth/callback] Request URL:", request.url);
  console.log("[auth/callback] Origin:", request.nextUrl.origin);
  console.log("[auth/callback] appUrl:", appUrl);
  console.log("[auth/callback] redirectUri:", redirectUri);
  console.log("[auth/callback] error param:", error);
  console.log("[auth/callback] code present:", !!code);
  console.log("[auth/callback] state param:", state);
  console.log("[auth/callback] storedState cookie:", storedState);
  console.log("[auth/callback] state match:", state === storedState);
  console.log("[auth/callback] codeVerifier present:", !!codeVerifier);
  console.log("[auth/callback] All cookies:", request.cookies.getAll().map(c => c.name));

  // Validate state to prevent CSRF
  if (error || !code || !state || state !== storedState || !codeVerifier) {
    console.error("[auth/callback] VALIDATION FAILED:", {
      hasError: !!error,
      errorValue: error,
      hasCode: !!code,
      hasState: !!state,
      stateMatch: state === storedState,
      hasCodeVerifier: !!codeVerifier,
    });
    return NextResponse.redirect(
      `${appUrl}/?error=${error || "auth_failed"}`
    );
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(`${appUrl}/?error=token_failed`);
    }

    const tokenData = await tokenRes.json();

    // Get user profile — retry up to 3 times on 429 (rate limit)
    let user;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        user = await getCurrentUser(tokenData.access_token);
        break; // success
      } catch (err: unknown) {
        const isRateLimit =
          err instanceof Error && err.message.includes("429");
        if (isRateLimit && attempt < 3) {
          console.warn(
            `[auth/callback] Spotify /me rate limited (429), retrying in ${attempt}s... (attempt ${attempt}/3)`
          );
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }
        throw err; // re-throw on last attempt or non-429 errors
      }
    }
    if (!user) throw new Error("Failed to fetch user profile after retries");

    // Build the JWT session token
    const sessionJwt = await createSession({
      userId: user.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: Date.now() + tokenData.expires_in * 1000,
      displayName: user.display_name,
      imageUrl: user.images?.[0]?.url,
    });

    // Build the redirect response and set ALL cookies on it directly.
    // ⚠️  Do NOT use setSessionCookie() here — that writes to the Next.js
    //     cookies() store which is attached to the *incoming* request, not to
    //     the redirect response we return. The browser would never see it.
    const isProduction = process.env.NODE_ENV === "production";
    const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

    const response = NextResponse.redirect(`${appUrl}/globe`);

    response.cookies.set("globify_session", sessionJwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
    response.cookies.delete("pkce_verifier");
    response.cookies.delete("oauth_state");

    console.log("[auth/callback] Session cookie set on redirect response, redirecting to /globe");
    return response;
  } catch (err) {
    console.error("Auth callback error:", err);
    return NextResponse.redirect(`${appUrl}/?error=server_error`);
  }
}

