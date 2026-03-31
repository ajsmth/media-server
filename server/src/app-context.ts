import type { AppConfig } from "./config";
import { AndroidDeviceClient } from "./services/android-device-client";
import { BrowserMediaTranscoder } from "./services/browser-media-transcoder";
import { createFileProcessingStatusProvider } from "./services/file-processing-status-provider";
import { LibraryCatalogService } from "./services/library-catalog-service";
import { MediaLibrary } from "./services/media-library";
import { MediaTitleOverrideService } from "./services/media-title-override-service";
import { PlaybackProgressService } from "./services/playback-progress-service";
import { ShowGroupingOverrideService } from "./services/show-grouping-override-service";
import { TitleExtractionService } from "./services/title-extraction-service";
import { TorrentDownloadService } from "./services/torrent-download-service";
import { TranscoderQueueService } from "./services/transcoder-queue-service";
import { VlcRemoteController } from "./services/vlc-remote-controller";

export type AppContext = {
  androidDeviceClient: AndroidDeviceClient;
  libraryCatalog: LibraryCatalogService;
  mediaLibrary: MediaLibrary;
  mediaTitleOverrideService: MediaTitleOverrideService;
  playbackProgressService: PlaybackProgressService;
  showGroupingOverrideService: ShowGroupingOverrideService;
  titleExtractionService: TitleExtractionService;
  torrentDownloadService: TorrentDownloadService;
  transcoderQueueService: TranscoderQueueService;
  vlcRemoteController: VlcRemoteController;
};

export async function createAppContext(config: AppConfig): Promise<AppContext> {
  const mediaLibrary = new MediaLibrary(config.mediaDir);
  const playbackProgressService = new PlaybackProgressService(
    config.playbackProgressFile,
  );
  const mediaTitleOverrideService = new MediaTitleOverrideService(
    config.mediaTitleOverridesFile,
  );
  const showGroupingOverrideService = new ShowGroupingOverrideService(
    config.showGroupingOverridesFile,
  );
  const titleExtractionService = new TitleExtractionService(
    config.openAiApiKey,
    config.openAiModel,
  );
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
    titleExtractionService,
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
    parseLogFilePath: config.libraryParseLogFile,
    playbackProgressProvider: (relativePath) =>
      playbackProgressService.get(relativePath),
    showGroupingOverrideResolver: (title) => showGroupingOverrideService.resolve(title),
    titleOverrideResolver: (kind, relativePaths) =>
      mediaTitleOverrideService.resolve(kind, relativePaths),
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

  await playbackProgressService.initialize();
  await mediaTitleOverrideService.initialize();
  await showGroupingOverrideService.initialize();
  await libraryCatalog.initialize();

  return {
    androidDeviceClient,
    libraryCatalog,
    mediaLibrary,
    mediaTitleOverrideService,
    playbackProgressService,
    showGroupingOverrideService,
    titleExtractionService,
    torrentDownloadService,
    transcoderQueueService,
    vlcRemoteController,
  };
}
