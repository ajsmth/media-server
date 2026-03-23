import type { AppConfig } from "./config";
import { AndroidDeviceClient } from "./services/android-device-client";
import { BrowserMediaTranscoder } from "./services/browser-media-transcoder";
import { createFileProcessingStatusProvider } from "./services/file-processing-status-provider";
import { LibraryCatalogService } from "./services/library-catalog-service";
import { MediaLibrary } from "./services/media-library";
import { TorrentDownloadService } from "./services/torrent-download-service";
import { TranscoderQueueService } from "./services/transcoder-queue-service";
import { VlcRemoteController } from "./services/vlc-remote-controller";

export type AppContext = {
  androidDeviceClient: AndroidDeviceClient;
  libraryCatalog: LibraryCatalogService;
  mediaLibrary: MediaLibrary;
  torrentDownloadService: TorrentDownloadService;
  transcoderQueueService: TranscoderQueueService;
  vlcRemoteController: VlcRemoteController;
};

export async function createAppContext(config: AppConfig): Promise<AppContext> {
  const mediaLibrary = new MediaLibrary(config.mediaDir);
  const browserMediaTranscoder = new BrowserMediaTranscoder(
    config.browserMediaDir,
  );

  let libraryCatalog: LibraryCatalogService;

  const transcoderQueueService = new TranscoderQueueService(
    browserMediaTranscoder,
    () => libraryCatalog.rescan().then(() => undefined),
  );

  const torrentDownloadService = new TorrentDownloadService(
    mediaLibrary,
    config.incompleteDownloadsDir,
    browserMediaTranscoder,
    () => libraryCatalog.rescan().then(() => undefined),
  );

  const fileProcessingStatusProvider = createFileProcessingStatusProvider({
    torrentDownloadService,
    transcoderQueueService,
  });

  libraryCatalog = new LibraryCatalogService(mediaLibrary, {
    fileProcessingStatusProvider,
    mediaDir: config.mediaDir,
    indexFilePath: config.libraryIndexFile,
  });

  const androidDeviceClient = new AndroidDeviceClient({
    host: config.nebulaIp,
    port: config.adbPort,
  });

  const vlcRemoteController = new VlcRemoteController(androidDeviceClient, {
    packageName: config.vlcPackage,
    appActivityName: config.vlcAppActivity,
    playbackActivityName: config.vlcPlaybackActivity,
  });

  await libraryCatalog.initialize();

  return {
    androidDeviceClient,
    libraryCatalog,
    mediaLibrary,
    torrentDownloadService,
    transcoderQueueService,
    vlcRemoteController,
  };
}
