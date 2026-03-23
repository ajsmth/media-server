import type { FileProcessingStatus } from "@media-server/shared";

import type { TorrentDownloadService } from "./torrent-download-service";
import type { TranscoderQueueService } from "./transcoder-queue-service";

export type FileProcessingStatusSnapshot = {
  state: FileProcessingStatus;
  progress: number | null;
  details: string | null;
};

export type FileProcessingStatusProvider = (
  relativePath: string,
) => FileProcessingStatusSnapshot | null;

type FileProcessingStatusProviderServices = {
  torrentDownloadService: TorrentDownloadService;
  transcoderQueueService: TranscoderQueueService;
};

export function createFileProcessingStatusProvider({
  torrentDownloadService,
  transcoderQueueService,
}: FileProcessingStatusProviderServices): FileProcessingStatusProvider {
  return (relativePath) =>
    transcoderQueueService.getStatus(relativePath) ??
    torrentDownloadService.getFileProcessingStatus(relativePath);
}
