import { useEffect, useState } from "react";

type LoadState = "idle" | "loading" | "error";
type TorrentDownload = {
  id: string;
  magnetLink: string;
  name: string | null;
  infoHash: string | null;
  status:
    | "starting"
    | "downloading"
    | "processing"
    | "completed"
    | "cancelled"
    | "error";
  progress: number;
  downloadedBytes: number;
  totalBytes: number | null;
  downloadSpeed: number;
  processingProgress: number | null;
  processingDetails: string | null;
  browserCopyPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdbStatus = {
  host: string;
  port: number;
  serial: string;
  connected: boolean;
  lastError: string | null;
};

type LibraryFile = {
  id: string;
  relativePath: string;
  basename: string;
  sizeBytes: number;
  modifiedAt: string;
  sourceUrl: string;
  browserUrl: string | null;
  browserCopyReady: boolean;
  parsed: {
    rawName: string;
    title: string;
    normalizedTitle: string;
    type: "movie" | "episode" | "other";
    year: number | null;
    seasonNumber: number | null;
    episodeNumbers: number[];
    tags: string[];
    confidence: "high" | "medium" | "low";
  };
};

type LibraryMovie = {
  id: string;
  title: string;
  sortTitle: string;
  year: number | null;
  files: LibraryFile[];
};

type LibraryEpisode = {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumbers: number[];
  files: LibraryFile[];
};

type LibrarySeason = {
  id: string;
  seasonNumber: number;
  episodes: LibraryEpisode[];
};

type LibraryShow = {
  id: string;
  title: string;
  sortTitle: string;
  seasons: LibrarySeason[];
};

type LibraryOtherVideo = {
  id: string;
  title: string;
  files: LibraryFile[];
};

type LibraryCatalog = {
  generatedAt: string;
  lastScanAt: string | null;
  movies: LibraryMovie[];
  shows: LibraryShow[];
  otherVideos: LibraryOtherVideo[];
};

type LibraryStatus = {
  state: "idle" | "scanning" | "error";
  lastScanAt: string | null;
  lastError: string | null;
  watchEnabled: boolean;
};

type PlayResponse = {
  status: "playing";
  fileId: string;
  launch: {
    mediaUrl: string;
    launch: {
      command: string;
      stdout: string;
    };
  };
};

type LaunchVlcResponse = {
  status: "launched";
  launch: {
    command: string;
    stdout: string;
  };
};

const EMPTY_LIBRARY: LibraryCatalog = {
  generatedAt: new Date(0).toISOString(),
  lastScanAt: null,
  movies: [],
  shows: [],
  otherVideos: [],
};

export default function App() {
  const [library, setLibrary] = useState<LibraryCatalog>(EMPTY_LIBRARY);
  const [selectedNebulaFileId, setSelectedNebulaFileId] = useState<string | null>(null);
  const [selectedBrowserFile, setSelectedBrowserFile] = useState<LibraryFile | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const [isRescanningLibrary, setIsRescanningLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [magnetLink, setMagnetLink] = useState("");
  const [downloads, setDownloads] = useState<TorrentDownload[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isSubmittingTorrent, setIsSubmittingTorrent] = useState(false);
  const [browserPlaybackError, setBrowserPlaybackError] = useState<string | null>(
    null,
  );
  const [adbStatus, setAdbStatus] = useState<AdbStatus | null>(null);
  const [adbError, setAdbError] = useState<string | null>(null);
  const [isConnectingAdb, setIsConnectingAdb] = useState(false);
  const [isLaunchingVlc, setIsLaunchingVlc] = useState(false);
  const [nebulaFeedback, setNebulaFeedback] = useState<string | null>(null);
  const [nebulaError, setNebulaError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function refreshLibrary() {
      try {
        const response = await fetch("/library");
        const nextLibrary = (await response.json()) as LibraryCatalog;

        if (isMounted) {
          setLibrary(nextLibrary);
          setLibraryError(null);
          setLoadState("idle");
        }
      } catch {
        if (isMounted) {
          setLoadState("error");
          setLibraryError("Unable to load the media library from the backend.");
        }
      }
    }

    async function loadLibrary() {
      setLoadState("loading");
      await refreshLibrary();
    }

    void loadLibrary();

    const intervalId = window.setInterval(() => {
      void refreshLibrary();
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLibraryStatus() {
      try {
        const response = await fetch("/library/status");
        const nextStatus = (await response.json()) as LibraryStatus;

        if (isMounted) {
          setLibraryStatus(nextStatus);
        }
      } catch {
        if (isMounted) {
          setLibraryStatus({
            state: "error",
            lastScanAt: null,
            lastError: "Unable to load library scan status.",
            watchEnabled: false,
          });
        }
      }
    }

    void loadLibraryStatus();

    const intervalId = window.setInterval(() => {
      void loadLibraryStatus();
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function readErrorMessage(
    response: Response,
    fallbackMessage: string,
  ): Promise<string> {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { error?: string };
      return payload.error ?? fallbackMessage;
    }

    const text = (await response.text()).trim();
    return text || fallbackMessage;
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAdbStatus() {
      try {
        const response = await fetch("/adb/status");
        const nextStatus = (await response.json()) as AdbStatus;
        if (isMounted) {
          setAdbStatus(nextStatus);
          setAdbError(null);
        }
      } catch {
        if (isMounted) {
          setAdbError("Unable to load projector connection status.");
        }
      }
    }

    void loadAdbStatus();

    const intervalId = window.setInterval(() => {
      void loadAdbStatus();
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDownloads() {
      try {
        const response = await fetch("/torrents");
        const nextDownloads = (await response.json()) as TorrentDownload[];
        if (isMounted) {
          setDownloads(nextDownloads);
        }
      } catch {
        if (isMounted) {
          setDownloadError("Unable to load torrent activity from the backend.");
        }
      }
    }

    void loadDownloads();

    const intervalId = window.setInterval(() => {
      void loadDownloads();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function refreshLibraryNow() {
    const response = await fetch("/library");
    const nextLibrary = (await response.json()) as LibraryCatalog;
    setLibrary(nextLibrary);
  }

  async function playFile(file: LibraryFile) {
    setSelectedNebulaFileId(file.id);
    setNebulaError(null);
    setNebulaFeedback(`Sending ${file.relativePath} to VLC...`);

    try {
      const response = await fetch("/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId: file.id }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Failed to launch VLC");
        setNebulaError(message);
        setNebulaFeedback(null);
        return;
      }

      const payload = (await response.json()) as PlayResponse;
      const mediaLaunchOutput = payload.launch.launch.stdout || "No output from media launch.";
      setNebulaFeedback(
        `Sent ${file.relativePath} to VLC at ${payload.launch.mediaUrl}. ${mediaLaunchOutput}`,
      );
    } catch (error) {
      setNebulaError(error instanceof Error ? error.message : "Failed to launch VLC");
      setNebulaFeedback(null);
    }
  }

  async function launchVlc() {
    setIsLaunchingVlc(true);
    setNebulaError(null);
    setNebulaFeedback("Launching VLC app...");

    try {
      const response = await fetch("/vlc/launch", {
        method: "POST",
      });

      if (!response.ok) {
        const message = await readErrorMessage(response, "Failed to launch VLC");
        setNebulaError(message);
        setNebulaFeedback(null);
        return;
      }

      const payload = (await response.json()) as LaunchVlcResponse;
      const launchOutput = payload.launch.stdout || "No output from app launch.";
      setNebulaFeedback(`Launched VLC app. ${launchOutput}`);
    } catch (error) {
      setNebulaError(error instanceof Error ? error.message : "Failed to launch VLC");
      setNebulaFeedback(null);
    } finally {
      setIsLaunchingVlc(false);
    }
  }

  async function rescanLibrary() {
    setIsRescanningLibrary(true);
    setLibraryError(null);

    try {
      const response = await fetch("/library/rescan", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to rescan library"));
      }

      const nextLibrary = (await response.json()) as LibraryCatalog;
      setLibrary(nextLibrary);

      const statusResponse = await fetch("/library/status");
      const nextStatus = (await statusResponse.json()) as LibraryStatus;
      setLibraryStatus(nextStatus);
    } catch (error) {
      setLibraryError(
        error instanceof Error ? error.message : "Failed to rescan library",
      );
    } finally {
      setIsRescanningLibrary(false);
    }
  }

  async function submitTorrent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!magnetLink.trim()) {
      setDownloadError("Enter a magnet link to start a torrent download.");
      return;
    }

    setIsSubmittingTorrent(true);
    setDownloadError(null);

    try {
      const response = await fetch("/torrents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ magnetLink }),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Failed to start torrent download"),
        );
      }

      const createdDownload = (await response.json()) as TorrentDownload;
      setDownloads((currentDownloads) => [createdDownload, ...currentDownloads]);
      setMagnetLink("");
      await refreshLibraryNow();
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Failed to start torrent download",
      );
    } finally {
      setIsSubmittingTorrent(false);
    }
  }

  async function cancelDownload(id: string) {
    try {
      setDownloadError(null);
      const response = await fetch(`/torrents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Failed to cancel torrent download"),
        );
      }

      const updatedDownload = (await response.json()) as TorrentDownload;
      setDownloads((currentDownloads) =>
        currentDownloads.map((download) =>
          download.id === updatedDownload.id ? updatedDownload : download,
        ),
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Failed to cancel torrent download",
      );
    }
  }

  async function playInBrowser(file: LibraryFile) {
    if (!file.browserUrl) {
      setBrowserPlaybackError("Browser-ready copy is not available yet.");
      return;
    }

    try {
      const response = await fetch(file.browserUrl, {
        method: "HEAD",
      });

      if (!response.ok) {
        throw new Error("Browser-ready copy is not available yet.");
      }

      setBrowserPlaybackError(null);
      setSelectedBrowserFile(file);
    } catch (error) {
      setBrowserPlaybackError(
        error instanceof Error
          ? error.message
          : "Browser-ready copy is not available yet.",
      );
    }
  }

  async function connectAdb() {
    setIsConnectingAdb(true);
    setAdbError(null);

    try {
      const response = await fetch("/adb/connect", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Unable to connect to projector"),
        );
      }

      const nextStatus = (await response.json()) as AdbStatus;
      setAdbStatus(nextStatus);
    } catch (error) {
      setAdbError(
        error instanceof Error ? error.message : "Unable to connect to projector",
      );
    } finally {
      setIsConnectingAdb(false);
    }
  }

  function formatProgress(download: TorrentDownload) {
    if (download.status === "processing" && download.processingProgress !== null) {
      return `Converting ${(download.processingProgress * 100).toFixed(1)}%`;
    }

    return `${(download.progress * 100).toFixed(1)}%`;
  }

  function renderFileActions(file: LibraryFile) {
    return (
      <div className="file-actions">
        <button
          className={
            selectedBrowserFile?.id === file.id ? "file-button active" : "file-button"
          }
          onClick={() => void playInBrowser(file)}
          type="button"
        >
          Browser
        </button>
        <button
          className={
            selectedNebulaFileId === file.id ? "file-button active" : "file-button"
          }
          onClick={() => void playFile(file)}
          type="button"
        >
          Nebula
        </button>
      </div>
    );
  }

  const totalTitles =
    library.movies.length + library.shows.length + library.otherVideos.length;

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Media server</p>
        <h1>Projector Control</h1>
        <p className="description">
          Import movies and shows from the media folder, track torrents, and send any
          cataloged file straight to VLC on the Nebula.
        </p>

        <section className="adb-card">
          <div className="section-heading">
            <h2>Projector connection</h2>
            <span className={adbStatus?.connected ? "status-pill connected" : "status-pill"}>
              {adbStatus?.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <p className="download-meta">
            Target: {adbStatus ? `${adbStatus.host}:${adbStatus.port}` : "Loading..."}
          </p>
          {adbStatus && <p className="download-meta">Serial: {adbStatus.serial}</p>}
          {adbStatus?.lastError && (
            <p className="status-message error">{adbStatus.lastError}</p>
          )}
          {adbError && <p className="status-message error">{adbError}</p>}
          <div className="torrent-actions">
            <button
              className="primary-button"
              disabled={isConnectingAdb}
              onClick={() => void connectAdb()}
              type="button"
            >
              {isConnectingAdb ? "Connecting..." : "Connect"}
            </button>
            <button
              className="secondary-button"
              disabled={isLaunchingVlc}
              onClick={() => void launchVlc()}
              type="button"
            >
              {isLaunchingVlc ? "Launching..." : "Launch VLC"}
            </button>
          </div>
        </section>

        <form className="torrent-form" onSubmit={(event) => void submitTorrent(event)}>
          <label className="field-label" htmlFor="magnet-link">
            Magnet link
          </label>
          <textarea
            className="magnet-input"
            id="magnet-link"
            onChange={(event) => setMagnetLink(event.target.value)}
            placeholder="magnet:?xt=urn:btih:..."
            rows={4}
            value={magnetLink}
          />
          <div className="torrent-actions">
            <button className="primary-button" disabled={isSubmittingTorrent} type="submit">
              {isSubmittingTorrent ? "Starting…" : "Start download"}
            </button>
            {downloadError && <p className="status-message error">{downloadError}</p>}
          </div>
        </form>

        <div className="downloads-section">
          <div className="section-heading">
            <h2>Active downloads</h2>
            <span>{downloads.length}</span>
          </div>
          {downloads.length === 0 && (
            <p className="empty-state">No torrent activity yet.</p>
          )}
          <ul className="download-list">
            {downloads.map((download) => {
              const isCancelable =
                download.status === "starting" || download.status === "downloading";

              return (
                <li className="download-card" key={download.id}>
                  <div className="download-header">
                    <div>
                      <p className="download-title">
                        {download.name ?? "Fetching torrent metadata…"}
                      </p>
                      <p className="download-meta">{download.status}</p>
                    </div>
                    {isCancelable && (
                      <button
                        className="secondary-button"
                        onClick={() => void cancelDownload(download.id)}
                        type="button"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-bar"
                      style={{ width: `${Math.max(download.progress * 100, 4)}%` }}
                    />
                  </div>
                  <p className="download-meta">
                    {formatProgress(download)}
                    {" · "}
                    {download.status === "processing"
                      ? "Preparing browser copy"
                      : download.totalBytes
                        ? `${Math.round(download.downloadSpeed / 1024)} KB/s`
                        : "Waiting for peers"}
                  </p>
                  {download.processingDetails && (
                    <p className="download-meta">{download.processingDetails}</p>
                  )}
                  {download.browserCopyPath && (
                    <p className="download-meta">
                      Browser copy: {download.browserCopyPath}
                    </p>
                  )}
                  {download.errorMessage && (
                    <p className="status-message error">{download.errorMessage}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <section className="library-section">
          <div className="section-heading">
            <div>
              <h2>Library</h2>
              <p className="download-meta">
                {totalTitles} titles · last scan{" "}
                {libraryStatus?.lastScanAt
                  ? new Date(libraryStatus.lastScanAt).toLocaleString()
                  : "pending"}
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={isRescanningLibrary}
              onClick={() => void rescanLibrary()}
              type="button"
            >
              {isRescanningLibrary ? "Rescanning..." : "Rescan library"}
            </button>
          </div>
          {libraryStatus?.state === "scanning" && (
            <p className="download-meta">Scanning media folder…</p>
          )}
          {libraryStatus?.lastError && (
            <p className="status-message error">{libraryStatus.lastError}</p>
          )}
          {loadState === "loading" && <p>Loading library…</p>}
          {loadState === "error" && (
            <p>Unable to load the media library from the backend.</p>
          )}
          {libraryError && <p className="status-message error">{libraryError}</p>}
          {nebulaFeedback && <p className="download-meta">{nebulaFeedback}</p>}
          {nebulaError && <p className="status-message error">{nebulaError}</p>}

          {selectedBrowserFile && (
            <section className="browser-player">
              <div className="section-heading">
                <h2>Browser player</h2>
                <span>{selectedBrowserFile.relativePath}</span>
              </div>
              {browserPlaybackError && (
                <p className="status-message error">{browserPlaybackError}</p>
              )}
              <video
                className="player-frame"
                controls
                key={selectedBrowserFile.id}
                onError={() =>
                  setBrowserPlaybackError(
                    "The browser-safe copy could not be played. It may still be transcoding.",
                  )
                }
                preload="metadata"
                src={selectedBrowserFile.browserUrl ?? undefined}
              />
            </section>
          )}

          <div className="library-grid">
            <section className="library-column">
              <div className="section-heading">
                <h2>Movies</h2>
                <span>{library.movies.length}</span>
              </div>
              {library.movies.length === 0 && (
                <p className="empty-state">No movies imported yet.</p>
              )}
              <ul className="library-list">
                {library.movies.map((movie) => (
                  <li className="library-card" key={movie.id}>
                    <div className="library-card-header">
                      <div>
                        <p className="download-title">
                          {movie.title}
                          {movie.year ? ` (${movie.year})` : ""}
                        </p>
                        <p className="download-meta">{movie.files.length} file(s)</p>
                      </div>
                    </div>
                    <ul className="file-list compact">
                      {movie.files.map((file) => (
                        <li className="file-card" key={file.id}>
                          <div className="file-name-row">
                            <span>{file.relativePath}</span>
                          </div>
                          {renderFileActions(file)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>

            <section className="library-column">
              <div className="section-heading">
                <h2>Shows</h2>
                <span>{library.shows.length}</span>
              </div>
              {library.shows.length === 0 && (
                <p className="empty-state">No shows imported yet.</p>
              )}
              <ul className="library-list">
                {library.shows.map((show) => (
                  <li className="library-card" key={show.id}>
                    <div className="library-card-header">
                      <div>
                        <p className="download-title">{show.title}</p>
                        <p className="download-meta">{show.seasons.length} season(s)</p>
                      </div>
                    </div>
                    <div className="season-stack">
                      {show.seasons.map((season) => (
                        <section className="season-card" key={season.id}>
                          <div className="section-heading">
                            <h2>Season {season.seasonNumber}</h2>
                            <span>{season.episodes.length} episode(s)</span>
                          </div>
                          <ul className="episode-list">
                            {season.episodes.map((episode) => (
                              <li className="episode-card" key={episode.id}>
                                <p className="download-title">
                                  {episode.title}
                                  {episode.episodeNumbers.length > 0
                                    ? ` · E${episode.episodeNumbers.join(", E")}`
                                    : ""}
                                </p>
                                <ul className="file-list compact">
                                  {episode.files.map((file) => (
                                    <li className="file-card" key={file.id}>
                                      <div className="file-name-row">
                                        <span>{file.relativePath}</span>
                                      </div>
                                      {renderFileActions(file)}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {library.otherVideos.length > 0 && (
            <section className="other-videos-section">
              <div className="section-heading">
                <h2>Unsorted</h2>
                <span>{library.otherVideos.length}</span>
              </div>
              <ul className="library-list">
                {library.otherVideos.map((group) => (
                  <li className="library-card" key={group.id}>
                    <p className="download-title">{group.title}</p>
                    <ul className="file-list compact">
                      {group.files.map((file) => (
                        <li className="file-card" key={file.id}>
                          <div className="file-name-row">
                            <span>{file.relativePath}</span>
                          </div>
                          {renderFileActions(file)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
