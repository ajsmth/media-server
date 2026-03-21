import { useState } from "react";
import { Download, LoaderCircle, WandSparkles } from "lucide-react";

import { useLibrary } from "@/hooks/use-library";
import { useTorrents } from "@/hooks/use-torrents";
import { DownloadList } from "@/components/downloads/download-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function DownloadsPage() {
  const { onTorrentImported } = useLibrary();
  const { downloads, startTorrentMutation, cancelTorrentMutation } =
    useTorrents();
  const [magnetLink, setMagnetLink] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleSubmitTorrent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!magnetLink.trim()) {
      setDownloadError("Enter a magnet link to start a torrent download.");
      return;
    }

    setDownloadError(null);

    try {
      const download = await startTorrentMutation.mutateAsync(magnetLink);
      await onTorrentImported(download);
      setMagnetLink("");
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Failed to start torrent download",
      );
    }
  }

  async function handleCancelDownload(id: string) {
    try {
      setDownloadError(null);
      await cancelTorrentMutation.mutateAsync(id);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Failed to cancel torrent download",
      );
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,243,234,0.92))]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="default">Intake</Badge>
              <Download className="size-5 text-primary" />
            </div>
            <CardTitle>Drop a magnet link</CardTitle>
            <CardDescription>
              Start the torrent, import the result into the media library, and
              keep the browser-safe copy pipeline visible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => void handleSubmitTorrent(event)}
            >
              <Textarea
                onChange={(event) => setMagnetLink(event.target.value)}
                placeholder="magnet:?xt=urn:btih:..."
                rows={6}
                value={magnetLink}
              />
              {downloadError ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {downloadError}
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={startTorrentMutation.status === "pending"}
                size="lg"
                type="submit"
              >
                {startTorrentMutation.status === "pending" ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Starting download
                  </>
                ) : (
                  "Start download"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-[linear-gradient(145deg,rgba(15,95,117,0.96),rgba(18,30,40,0.96))] text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge
                className="border-white/15 bg-white/10 text-white"
                variant="outline"
              >
                Pipeline
              </Badge>
              <WandSparkles className="size-5 text-white/70" />
            </div>
            <CardTitle className="text-white">How intake flows now</CardTitle>
            <CardDescription className="text-white/72">
              Torrents are no longer a side panel on the library page. This
              route owns the queue and import lifecycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-white/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              1. Submit the magnet link.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              2. Track download and post-processing here.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              3. Open the library route when the new title lands.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
              Queue
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Active downloads
            </h3>
          </div>
          <Badge variant="secondary">{downloads.length} items</Badge>
        </div>
        <DownloadList downloads={downloads} onCancel={handleCancelDownload} />
      </section>
    </div>
  );
}
