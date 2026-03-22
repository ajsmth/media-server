import type { LibraryFileRecord } from "@media-server/shared";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BrowserPlayerProps = {
  file: LibraryFileRecord;
  error: string | null;
  modeLabel?: string;
  onVideoError: () => void;
  src?: string;
};

export function BrowserPlayer({
  file,
  error,
  modeLabel = "Browser player",
  onVideoError,
  src,
}: BrowserPlayerProps) {
  return (
    <Card className="overflow-hidden bg-slate-950 text-white">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-white">{modeLabel}</CardTitle>
        <CardDescription className="text-white/65">
          {file.relativePath}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {error ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        <video
          className="aspect-video w-full rounded-[1.5rem] bg-black"
          controls
          key={file.id}
          onError={onVideoError}
          preload="metadata"
          src={src ?? file.browserUrl ?? undefined}
        />
      </CardContent>
    </Card>
  );
}
