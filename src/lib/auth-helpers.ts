import { getSession, updateSessionTokens } from "@/lib/session";
import { refreshAccessToken } from "@/lib/spotify";

/**
 * Get a valid access token, refreshing if needed.
 * Returns null if not authenticated.
 */
export async function getValidAccessToken(): Promise<{
  accessToken: string;
  userId: string;
} | null> {
  const session = await getSession();
  if (!session) return null;

  // If token expires in less than 5 minutes, refresh
  if (session.tokenExpiresAt < Date.now() + 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(session.refreshToken);
      await updateSessionTokens(
        refreshed.access_token,
        refreshed.refresh_token,
        refreshed.expires_in
      );
      return { accessToken: refreshed.access_token, userId: session.userId };
    } catch {
      return null;
    }
  }

  return { accessToken: session.accessToken, userId: session.userId };
}
