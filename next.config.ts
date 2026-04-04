import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://127.0.0.1:3000", "http://localhost:3000"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
    ],
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(isDev
            ? [] // Skip CSP in development to avoid blocking HMR WebSocket
            : [
                {
                  key: "Content-Security-Policy",
                  value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: blob: https://i.scdn.co https://mosaic.scdn.co https://*.spotifycdn.com https://unpkg.com",
                    "font-src 'self'",
                    "frame-src https://open.spotify.com",
                    "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://musicbrainz.org https://www.wikidata.org https://cdn.jsdelivr.net https://unpkg.com",
                  ].join("; "),
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
