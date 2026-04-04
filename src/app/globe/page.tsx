import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import GlobeView from "@/components/GlobeView";

export default async function GlobePage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent">
            Globify
          </span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">
            {session.displayName}
          </span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* Globe + Analytics */}
      <GlobeView />
    </main>
  );
}
