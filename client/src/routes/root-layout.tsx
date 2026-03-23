import { Outlet, useLocation } from "react-router";

import { AppSidebar } from "@/components/app/app-sidebar";
import { PlayerModal } from "@/components/library/player-modal";
import { ProjectorStatusCard } from "@/components/app/projector-status-card";

const pageMeta = {
  "/": {
    eyebrow: "Home",
    title: "Projector media stack",
    description: "",
  },
  "/library": {
    eyebrow: "Library",
    title: "Folder browser",
    description:
      "Navigate the media folder directly, inspect files, and launch browser or projector playback only when needed.",
  },
  "/downloads": {
    eyebrow: "Downloads",
    title: "Queue",
    description:
      "Start torrents and monitor the queue without the pipeline narration.",
  },
} as const;

export function RootLayout() {
  const location = useLocation();
  const meta =
    pageMeta[location.pathname as keyof typeof pageMeta] ?? pageMeta["/"];

  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-[1600px] gap-6 md:items-start md:grid-cols-[280px_minmax(0,1fr)]">
        <AppSidebar />

        <div className="grid self-start gap-6">
          <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <div className="rounded-[1.75rem] border border-border/70 bg-white/55 px-6 py-6 shadow-[0_24px_70px_rgba(88,61,26,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">
                {meta.eyebrow}
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {meta.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
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
      <PlayerModal />
    </div>
  );
}
