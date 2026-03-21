import { Clapperboard, Download, Gauge } from "lucide-react";
import { NavLink } from "react-router";

import { cn } from "@/lib/utils";

const navigationItems = [
  {
    to: "/",
    label: "Overview",
    description: "Main actions and status",
    icon: Gauge,
  },
  {
    to: "/library",
    label: "Library",
    description: "Folder browser and playback",
    icon: Clapperboard,
  },
  {
    to: "/downloads",
    label: "Downloads",
    description: "Queue and errors",
    icon: Download,
  },
];

export function AppSidebar() {
  return (
    <aside className="flex flex-col gap-6 rounded-[1.75rem] border border-border/70 bg-white/60 p-4 shadow-[0_24px_70px_rgba(88,61,26,0.08)] backdrop-blur md:sticky md:top-6 md:h-[calc(100vh-3rem)]">
      <nav className="grid gap-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "group rounded-[1.1rem] border border-transparent px-4 py-3 transition-colors",
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
