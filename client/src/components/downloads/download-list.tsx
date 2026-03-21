import type { TorrentDownloadRecord } from "@media-server/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle>Queue is clear</CardTitle>
          <CardDescription>
            New torrent activity will appear here as soon as you submit a
            magnet link.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {downloads.map((download) => {
        const isCancelable =
          download.status === "starting" || download.status === "downloading";

        return (
          <Card key={download.id}>
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-base">
                    {download.name ?? "Fetching torrent metadata..."}
                  </CardTitle>
                  <Badge variant={statusVariant(download.status)}>
                    {download.status}
                  </Badge>
                </div>
                <CardDescription className="mt-2">
                  {formatProgress(download)}
                  {" · "}
                  {download.status === "processing"
                    ? "Preparing browser copy"
                    : download.totalBytes
                      ? `${Math.round(download.downloadSpeed / 1024)} KB/s`
                      : "Waiting for peers"}
                </CardDescription>
              </div>
              {isCancelable ? (
                <Button onClick={() => onCancel(download.id)} variant="outline">
                  Cancel
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={download.progress * 100} />
              {download.processingDetails ? (
                <p className="text-sm text-muted-foreground">
                  {download.processingDetails}
                </p>
              ) : null}
              {download.browserCopyPath ? (
                <p className="text-sm text-muted-foreground">
                  Browser copy: {download.browserCopyPath}
                </p>
              ) : null}
              {download.errorMessage ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {download.errorMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
