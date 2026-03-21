import { Clapperboard, Download, Gauge } from "lucide-react";
import { NavLink } from "react-router";

import { cn } from "@/lib/utils";

const navigationItems = [
  {
    to: "/",
    label: "Overview",
    description: "System health and quick actions",
    icon: Gauge,
  },
  {
    to: "/library",
    label: "Library",
    description: "Movies, shows, browser playback, projector send",
    icon: Clapperboard,
  },
  {
    to: "/downloads",
    label: "Downloads",
    description: "Add torrents and monitor processing",
    icon: Download,
  },
];

export function AppSidebar() {
  return (
    <aside className="flex flex-col gap-6 rounded-[2rem] border border-border/70 bg-white/60 p-5 shadow-[0_30px_80px_rgba(88,61,26,0.08)] backdrop-blur md:sticky md:top-6 md:h-[calc(100vh-3rem)]">
      <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(15,95,117,0.95),rgba(223,122,63,0.88))] p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
          Projector stack
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Media control
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/82">
          Library import, torrent intake, and projector playback in one place.
        </p>
      </div>

      <nav className="grid gap-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "group rounded-[1.4rem] border border-transparent px-4 py-4 transition-colors",
                  isActive
                    ? "border-primary/15 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:border-border hover:bg-white/65 hover:text-foreground",
                )
              }
              key={item.to}
              to={item.to}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white/70 p-2 text-primary shadow-sm transition-colors group-hover:bg-white">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight">{item.label}</p>
                  <p className="mt-1 text-sm leading-snug opacity-80">
                    {item.description}
                  </p>
                </div>
              </div>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
