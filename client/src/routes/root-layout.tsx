import { Outlet, useLocation } from "react-router";

import { AppSidebar } from "@/components/app/app-sidebar";
import { ProjectorStatusCard } from "@/components/app/projector-status-card";

const pageMeta = {
  "/": {
    eyebrow: "System view",
    title: "Projector media stack",
    description:
      "Route the app into clear work areas: overview, library operations, and torrent intake.",
  },
  "/library": {
    eyebrow: "Library",
    title: "Catalog and playback",
    description:
      "Browse imported movies and shows, trigger projector playback, or open browser-ready copies.",
  },
  "/downloads": {
    eyebrow: "Downloads",
    title: "Torrent intake",
    description:
      "Submit new magnet links, monitor transfer state, and watch post-processing progress.",
  },
} as const;

export function RootLayout() {
  const location = useLocation();
  const meta = pageMeta[location.pathname as keyof typeof pageMeta] ?? pageMeta["/"];

  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-[1600px] gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <AppSidebar />

        <div className="grid gap-6">
          <header className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-[2rem] border border-border/70 bg-white/55 px-6 py-7 shadow-[0_30px_90px_rgba(88,61,26,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">
                {meta.eyebrow}
              </p>
              <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                {meta.title}
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
                {meta.description}
              </p>
            </div>
            <ProjectorStatusCard />
          </header>

          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
