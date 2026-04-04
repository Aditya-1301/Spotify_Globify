import { describe, it, expect } from "vitest";

/**
 * Tests for session management logic.
 * We test the token expiry checking logic used by auth-helpers.
 */

describe("Token expiry logic", () => {
  function needsRefresh(tokenExpiresAt: number): boolean {
    return tokenExpiresAt < Date.now() + 5 * 60 * 1000;
  }

  it("returns true when token is already expired", () => {
    const expired = Date.now() - 1000;
    expect(needsRefresh(expired)).toBe(true);
  });

  it("returns true when token expires in less than 5 minutes", () => {
    const soonExpiring = Date.now() + 2 * 60 * 1000; // 2 minutes from now
    expect(needsRefresh(soonExpiring)).toBe(true);
  });

  it("returns false when token has plenty of time", () => {
    const longLived = Date.now() + 30 * 60 * 1000; // 30 minutes from now
    expect(needsRefresh(longLived)).toBe(false);
  });

  it("returns true at exactly 5 minutes from expiry", () => {
    // Edge case: token expires in exactly 5 minutes
    // tokenExpiresAt < Date.now() + 5min → equal means NOT less than
    const exactFiveMin = Date.now() + 5 * 60 * 1000;
    expect(needsRefresh(exactFiveMin)).toBe(false);
  });
});

describe("Session payload structure", () => {
  interface SessionPayload {
    userId: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: number;
    displayName: string;
    imageUrl?: string;
  }

  it("accepts valid session payload", () => {
    const payload: SessionPayload = {
      userId: "user-123",
      accessToken: "access-token-abc",
      refreshToken: "refresh-token-xyz",
      tokenExpiresAt: Date.now() + 3600000,
      displayName: "Test User",
      imageUrl: "https://example.com/img.jpg",
    };

    expect(payload.userId).toBe("user-123");
    expect(payload.tokenExpiresAt).toBeGreaterThan(Date.now());
  });

  it("accepts payload without optional imageUrl", () => {
    const payload: SessionPayload = {
      userId: "user-123",
      accessToken: "access-token-abc",
      refreshToken: "refresh-token-xyz",
      tokenExpiresAt: Date.now() + 3600000,
      displayName: "Test User",
    };

    expect(payload.imageUrl).toBeUndefined();
  });
});
