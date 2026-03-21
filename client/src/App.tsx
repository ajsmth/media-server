import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LibraryCatalogSnapshot,
  LibraryFileRecord,
  TorrentDownloadRecord,
} from "@media-server/shared";

import { client, queryKeys } from "./fetch-client";

const EMPTY_LIBRARY: LibraryCatalogSnapshot = {
  generatedAt: new Date(0).toISOString(),
  lastScanAt: null,
  movies: [],
  shows: [],
  otherVideos: [],
};

export default function App() {
  const queryClient = useQueryClient();
  const [selectedNebulaFileId, setSelectedNebulaFileId] = useState<
    string | null
  >(null);
  const [selectedBrowserFile, setSelectedBrowserFile] =
    useState<LibraryFileRecord | null>(null);
  const [magnetLink, setMagnetLink] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [browserPlaybackError, setBrowserPlaybackError] = useState<
    string | null
  >(null);
  const [adbError, setAdbError] = useState<string | null>(null);
  const [nebulaFeedback, setNebulaFeedback] = useState<string | null>(null);
  const [nebulaError, setNebulaError] = useState<string | null>(null);

  const libraryQuery = useQuery({
    queryKey: queryKeys.library,
    queryFn: () => client.getLibrary(),
    refetchInterval: 5000,
  });

  const libraryStatusQuery = useQuery({
    queryKey: queryKeys.libraryStatus,
    queryFn: () => client.getLibraryStatus(),
    refetchInterval: 5000,
  });

  const adbStatusQuery = useQuery({
    queryKey: queryKeys.adbStatus,
    queryFn: () => client.getAdbStatus(),
    refetchInterval: 5000,
  });

  const torrentsQuery = useQuery({
    queryKey: queryKeys.torrents,
    queryFn: () => client.getTorrents(),
    refetchInterval: 2000,
  });

  const playFileMutation = useMutation({
    mutationFn: (fileId: string) => client.playFile(fileId),
  });

  const launchVlcMutation = useMutation({
    mutationFn: () => client.launchVlc(),
  });

  const rescanLibraryMutation = useMutation({
    mutationFn: () => client.rescanLibrary(),
    onSuccess: async (snapshot) => {
      queryClient.setQueryData(queryKeys.library, snapshot);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.libraryStatus,
      });
    },
  });

  const startTorrentMutation = useMutation({
    mutationFn: (magnetLink: string) => client.startTorrent(magnetLink),
    onSuccess: async (download) => {
      queryClient.setQueryData(
        queryKeys.torrents,
        (currentDownloads: TorrentDownloadRecord[] = []) => [
          download,
          ...currentDownloads,
        ],
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.library });
    },
  });

  const cancelTorrentMutation = useMutation({
    mutationFn: (id: string) => client.cancelTorrent(id),
    onSuccess: (updatedDownload) => {
      queryClient.setQueryData(
        queryKeys.torrents,
        (currentDownloads: TorrentDownloadRecord[] = []) =>
          currentDownloads.map((download) =>
            download.id === updatedDownload.id ? updatedDownload : download,
          ),
      );
    },
  });

  const connectAdbMutation = useMutation({
    mutationFn: () => client.connectAdb(),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.adbStatus, status);
    },
  });

  const library = libraryQuery.data ?? EMPTY_LIBRARY;
  const libraryStatus = libraryStatusQuery.data ?? null;
  const adbStatus = adbStatusQuery.data ?? null;
  const downloads = torrentsQuery.data ?? [];
  const loadState =
    libraryQuery.status === "pending"
      ? "loading"
      : libraryQuery.isError
        ? "error"
        : "idle";
  const libraryError = libraryQuery.isError
    ? libraryQuery.error instanceof Error
      ? libraryQuery.error.message
      : "Unable to load the media library from the backend."
    : rescanLibraryMutation.isError
      ? rescanLibraryMutation.error instanceof Error
        ? rescanLibraryMutation.error.message
        : "Failed to rescan library"
      : null;

  async function handlePlayFile(file: LibraryFileRecord) {
    setSelectedNebulaFileId(file.id);
    setNebulaError(null);
    setNebulaFeedback(`Sending ${file.relativePath} to VLC...`);

    try {
      const payload = await playFileMutation.mutateAsync(file.id);
      const mediaLaunchOutput =
        payload.launch.launch.stdout || "No output from media launch.";
      setNebulaFeedback(
        `Sent ${file.relativePath} to VLC at ${payload.launch.mediaUrl}. ${mediaLaunchOutput}`,
      );
    } catch (error) {
      setNebulaError(
        error instanceof Error ? error.message : "Failed to launch VLC",
      );
      setNebulaFeedback(null);
    }
  }

  async function handleLaunchVlc() {
    setNebulaError(null);
    setNebulaFeedback("Launching VLC app...");

    try {
      const payload = await launchVlcMutation.mutateAsync();
      const launchOutput =
        payload.launch.stdout || "No output from app launch.";
      setNebulaFeedback(`Launched VLC app. ${launchOutput}`);
    } catch (error) {
      setNebulaError(
        error instanceof Error ? error.message : "Failed to launch VLC",
      );
      setNebulaFeedback(null);
    }
  }

  async function handleRescanLibrary() {
    try {
      await rescanLibraryMutation.mutateAsync();
    } catch {
      // Error state is surfaced from the mutation.
    }
  }

  async function handleSubmitTorrent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!magnetLink.trim()) {
      setDownloadError("Enter a magnet link to start a torrent download.");
      return;
    }

    setDownloadError(null);

    try {
      await startTorrentMutation.mutateAsync(magnetLink);
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

  async function handlePlayInBrowser(file: LibraryFileRecord) {
    if (!file.browserUrl) {
      setBrowserPlaybackError("Browser-ready copy is not available yet.");
      return;
    }

    try {
      await client.ensureBrowserReady(file.browserUrl);
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

  async function handleConnectAdb() {
    setAdbError(null);

    try {
      await connectAdbMutation.mutateAsync();
    } catch (error) {
      setAdbError(
        error instanceof Error
          ? error.message
          : "Unable to connect to projector",
      );
    }
  }

  function formatProgress(download: TorrentDownloadRecord) {
    if (
      download.status === "processing" &&
      download.processingProgress !== null
    ) {
      return `Converting ${(download.processingProgress * 100).toFixed(1)}%`;
    }

    return `${(download.progress * 100).toFixed(1)}%`;
  }

  function renderFileActions(file: LibraryFileRecord) {
    return (
      <div className="file-actions">
        <button
          className={
            selectedBrowserFile?.id === file.id
              ? "file-button active"
              : "file-button"
          }
          onClick={() => void handlePlayInBrowser(file)}
          type="button"
        >
          Browser
        </button>
        <button
          className={
            selectedNebulaFileId === file.id
              ? "file-button active"
              : "file-button"
          }
          onClick={() => void handlePlayFile(file)}
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
          Import movies and shows from the media folder, track torrents, and
          send any cataloged file straight to VLC on the Nebula.
        </p>

        <section className="adb-card">
          <div className="section-heading">
            <h2>Projector connection</h2>
            <span
              className={
                adbStatus?.connected ? "status-pill connected" : "status-pill"
              }
            >
              {adbStatus?.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <p className="download-meta">
            Target:{" "}
            {adbStatus ? `${adbStatus.host}:${adbStatus.port}` : "Loading..."}
          </p>
          {adbStatus && (
            <p className="download-meta">Serial: {adbStatus.serial}</p>
          )}
          {adbStatus?.lastError && (
            <p className="status-message error">{adbStatus.lastError}</p>
          )}
          {adbError && <p className="status-message error">{adbError}</p>}
          <div className="torrent-actions">
            <button
              className="primary-button"
              disabled={connectAdbMutation.status === "pending"}
              onClick={() => void handleConnectAdb()}
              type="button"
            >
              {connectAdbMutation.status === "pending"
                ? "Connecting..."
                : "Connect"}
            </button>
            <button
              className="secondary-button"
              disabled={launchVlcMutation.status === "pending"}
              onClick={() => void handleLaunchVlc()}
              type="button"
            >
              {launchVlcMutation.status === "pending"
                ? "Launching..."
                : "Launch VLC"}
            </button>
          </div>
        </section>

        <form
          className="torrent-form"
          onSubmit={(event) => void handleSubmitTorrent(event)}
        >
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
            <button
              className="primary-button"
              disabled={startTorrentMutation.status === "pending"}
              type="submit"
            >
              {startTorrentMutation.status === "pending"
                ? "Starting…"
                : "Start download"}
            </button>
            {downloadError && (
              <p className="status-message error">{downloadError}</p>
            )}
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
                download.status === "starting" ||
                download.status === "downloading";

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
                        onClick={() => void handleCancelDownload(download.id)}
                        type="button"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.max(download.progress * 100, 4)}%`,
                      }}
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
                    <p className="download-meta">
                      {download.processingDetails}
                    </p>
                  )}
                  {download.browserCopyPath && (
                    <p className="download-meta">
                      Browser copy: {download.browserCopyPath}
                    </p>
                  )}
                  {download.errorMessage && (
                    <p className="status-message error">
                      {download.errorMessage}
                    </p>
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
              disabled={rescanLibraryMutation.status === "pending"}
              onClick={() => void handleRescanLibrary()}
              type="button"
            >
              {rescanLibraryMutation.status === "pending"
                ? "Rescanning..."
                : "Rescan library"}
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
          {libraryError && (
            <p className="status-message error">{libraryError}</p>
          )}
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
                        <p className="download-meta">
                          {movie.files.length} file(s)
                        </p>
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
                        <p className="download-meta">
                          {show.seasons.length} season(s)
                        </p>
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
