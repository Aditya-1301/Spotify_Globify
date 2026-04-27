import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SCOPES = [
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
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
  // sameSite: "none" is required because Spotify's redirect back is a
  // cross-site navigation (accounts.spotify.com → your domain). With "lax",
  // the browser/Vercel edge drops these cookies on the return trip.
  // "none" requires secure: true, which is always true in production.
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set("pkce_verifier", codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
