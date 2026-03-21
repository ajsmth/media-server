import type { TorrentDownloadRecord } from "@media-server/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

function formatProgress(download: TorrentDownloadRecord) {
  if (
    download.status === "processing" &&
    download.processingProgress !== null
  ) {
    return `Converting ${(download.processingProgress * 100).toFixed(1)}%`;
  }

  return `${(download.progress * 100).toFixed(1)}%`;
}

function statusVariant(status: TorrentDownloadRecord["status"]) {
  switch (status) {
    case "completed":
      return "success";
    case "error":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

type DownloadListProps = {
  downloads: TorrentDownloadRecord[];
  onCancel: (id: string) => void;
};

export function DownloadList({ downloads, onCancel }: DownloadListProps) {
  if (downloads.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-white/55 px-5 py-8 text-sm text-muted-foreground">
        Queue is clear.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {downloads.map((download) => {
        const isCancelable =
          download.status === "starting" || download.status === "downloading";

        return (
          <div
            className="rounded-[1.4rem] border border-border/70 bg-white/65 p-4 shadow-[0_16px_40px_rgba(66,44,22,0.05)] backdrop-blur"
            key={download.id}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-base font-semibold text-foreground">
                    {download.name ?? "Fetching torrent metadata..."}
                  </p>
                  <Badge variant={statusVariant(download.status)}>
                    {download.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatProgress(download)}
                  {" · "}
                  {download.status === "processing"
                    ? "Post-processing"
                    : download.totalBytes
                      ? `${Math.round(download.downloadSpeed / 1024)} KB/s`
                      : "Waiting for peers"}
                </p>
              </div>
              {isCancelable ? (
                <Button onClick={() => onCancel(download.id)} variant="outline">
                  Cancel
                </Button>
              ) : null}
            </div>
            <div className="mt-4 space-y-4">
              <Progress value={download.progress * 100} />
              {download.errorMessage ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {download.errorMessage}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
