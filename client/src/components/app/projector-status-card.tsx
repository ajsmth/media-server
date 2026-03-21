import { LoaderCircle, Wifi } from "lucide-react";

import { useProjector } from "@/hooks/use-projector";

export function ProjectorStatusCard() {
  const { adbStatus, connectAdbMutation } = useProjector();

  const projectorState = adbStatus?.connected ? "Connected" : "Disconnected";
  const isBusy = connectAdbMutation.status === "pending";

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-white/70 p-3 shadow-[0_18px_50px_rgba(66,44,22,0.08)] backdrop-blur">
      <div className="px-3 pb-3 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70">
          Projector / Nebula
        </p>
      </div>

      <button
        className="flex w-full items-center justify-between gap-4 rounded-[1.2rem] border border-border/70 bg-white/80 px-4 py-4 text-left transition-colors hover:bg-white disabled:cursor-wait"
        disabled={isBusy}
        onClick={() => void connectAdbMutation.mutateAsync()}
        type="button"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${
                adbStatus?.connected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <p className="text-base font-semibold text-foreground">
              {isBusy ? "Reconnecting..." : projectorState}
            </p>
          </div>
        </div>
        {isBusy ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Wifi className="size-4 shrink-0 text-primary" />
        )}
      </button>

      <div className="space-y-3 px-3 pb-1 pt-3">
        {adbStatus?.lastError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {adbStatus.lastError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
