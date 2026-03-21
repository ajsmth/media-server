import { LoaderCircle, Radio, Wifi } from "lucide-react";

import { useProjector } from "@/hooks/use-projector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProjectorStatusCard() {
  const { adbStatus, connectAdbMutation, launchVlcMutation } = useProjector();

  const projectorState = adbStatus?.connected ? "Connected" : "Disconnected";

  return (
    <Card className="overflow-hidden border-primary/10 bg-white/72">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
              Projector
            </p>
            <CardTitle className="mt-2">Nebula control</CardTitle>
            <CardDescription className="mt-1">
              Keep the ADB bridge warm and bring VLC forward before sending a
              title from the library.
            </CardDescription>
          </div>
          <Badge variant={adbStatus?.connected ? "success" : "outline"}>
            {projectorState}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-secondary/70 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Target
            </dt>
            <dd className="mt-2 font-medium text-foreground">
              {adbStatus ? `${adbStatus.host}:${adbStatus.port}` : "Loading..."}
            </dd>
          </div>
          <div className="rounded-2xl bg-secondary/70 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Serial
            </dt>
            <dd className="mt-2 font-medium text-foreground">
              {adbStatus?.serial ?? "Pending"}
            </dd>
          </div>
          <div className="rounded-2xl bg-secondary/70 p-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Bridge
            </dt>
            <dd className="mt-2 flex items-center gap-2 font-medium text-foreground">
              {adbStatus?.connected ? (
                <Wifi className="size-4 text-emerald-600" />
              ) : (
                <Radio className="size-4 text-amber-600" />
              )}
              {projectorState}
            </dd>
          </div>
        </dl>

        {adbStatus?.lastError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {adbStatus.lastError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            disabled={connectAdbMutation.status === "pending"}
            onClick={() => void connectAdbMutation.mutateAsync()}
          >
            {connectAdbMutation.status === "pending" ? (
              <>
                <LoaderCircle className="animate-spin" />
                Connecting
              </>
            ) : (
              "Connect projector"
            )}
          </Button>
          <Button
            disabled={launchVlcMutation.status === "pending"}
            onClick={() => void launchVlcMutation.mutateAsync()}
            variant="outline"
          >
            {launchVlcMutation.status === "pending" ? (
              <>
                <LoaderCircle className="animate-spin" />
                Launching VLC
              </>
            ) : (
              "Launch VLC"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
