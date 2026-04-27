import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect("/globe");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(29,185,84,0.15)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.1)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto">
        {/* Logo / Brand */}
        <div className="mb-8">
          <h1 className="text-6xl sm:text-8xl font-bold tracking-tighter">
            <span className="bg-gradient-to-r from-accent via-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Globify
            </span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-muted max-w-lg mx-auto leading-relaxed">
            See where your music comes from. Explore an interactive 3D globe
            of your listening habits, discover artists worldwide, and build
            playlists from every corner of the earth.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          {[
            "3D Globe Visualization",
            "Country-by-Country Breakdown",
            "Smart Recommendations",
            "Auto Playlist Creation",
            "Music Passport",
            "Shareable Visa Cards",
          ].map((feature) => (
            <span
              key={feature}
              className="px-4 py-1.5 text-sm rounded-full border border-border text-muted bg-surface"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* Login button — must be a plain <a>, NOT <Link>.
            Next.js <Link> prefetches the href as a background fetch request.
            When /api/auth/login returns a 302 to accounts.spotify.com, the
            browser follows it cross-origin as a fetch, triggering a CORS error.
            A plain <a> causes a full top-level navigation instead. */}
        <a
          href="/api/auth/login"
          className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-accent text-black font-semibold text-lg transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(29,185,84,0.3)] active:scale-95"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Connect with Spotify
        </a>

        <p className="mt-6 text-xs text-muted">
          We only read your listening data. We never store your personal information on our servers.
        </p>
      </div>

      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </main>
  );
}
