// Playlist creation is temporarily disabled — requires write scopes that are
// not requested in this read-only iteration of the app.
// Re-enable by restoring the full implementation and adding
// "playlist-modify-public" / "playlist-modify-private" back to the OAuth scopes.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Playlist creation is not available in this version." },
    { status: 404 }
  );
}
