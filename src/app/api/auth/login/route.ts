import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SCOPES = [
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString("base64url");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return Buffer.from(hash).toString("base64url");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ||
    process.env.NEXT_PUBLIC_REDIRECT_URI ||
    `${request.nextUrl.origin}/api/auth/callback`;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing Spotify configuration" },
      { status: 500 }
    );
  }

  // Spotify requires the redirect URI to exactly match the one registered in the
  // developer dashboard. If the user arrives on a different hostname (e.g. "localhost"
  // while the registered URI uses "127.0.0.1"), cookie-based PKCE state won't survive
  // the Spotify redirect. Bounce the browser to the correct hostname first.
  const required = new URL(redirectUri).hostname;
  if (request.nextUrl.hostname !== required) {
    const corrected = new URL(request.url);
    corrected.hostname = required;
    return NextResponse.redirect(corrected.toString());
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params}`;

  const response = NextResponse.redirect(authUrl);

  // Store PKCE verifier and state in HTTP-only cookies
  response.cookies.set("pkce_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
