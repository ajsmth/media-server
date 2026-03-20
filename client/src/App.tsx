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

export default function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedNebulaFile, setSelectedNebulaFile] = useState<string | null>(null);
  const [selectedBrowserFile, setSelectedBrowserFile] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
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

  useEffect(() => {
    let isMounted = true;

    async function refreshLibrary() {
      try {
        const response = await fetch("/files");
        const nextFiles = (await response.json()) as string[];
        if (isMounted) {
          setFiles(nextFiles);
          setLoadState("idle");
        }
      } catch {
        if (isMounted) {
          setLoadState("error");
        }
      }
    }

    async function loadFiles() {
      setLoadState("loading");
      await refreshLibrary();
    }

    void loadFiles();

    const intervalId = window.setInterval(() => {
      void refreshLibrary();
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

  async function playFile(file: string) {
    setSelectedNebulaFile(file);

    await fetch("/play", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file }),
    });
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

  async function playInBrowser(file: string) {
    const browserMediaUrl = toBrowserMediaUrl(file);

    try {
      const response = await fetch(browserMediaUrl, {
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

  function toBrowserMediaUrl(file: string) {
    const normalizedPath = file.replace(/\.[^.]+$/, ".mp4");
    return `/media/browser/${normalizedPath.split("/").map(encodeURIComponent).join("/")}`;
  }

  function formatProgress(download: TorrentDownload) {
    if (download.status === "processing" && download.processingProgress !== null) {
      return `Converting ${(download.processingProgress * 100).toFixed(1)}%`;
    }

    return `${(download.progress * 100).toFixed(1)}%`;
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="eyebrow">Media server</p>
        <h1>Projector Control</h1>
        <p className="description">
          Paste a magnet link to download media, then send completed files to VLC on
          the Nebula.
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

        {loadState === "loading" && <p>Loading files…</p>}
        {loadState === "error" && (
          <p>Unable to load the media library from the backend.</p>
        )}

        {selectedBrowserFile && (
          <section className="browser-player">
            <div className="section-heading">
              <h2>Browser player</h2>
              <span>{selectedBrowserFile}</span>
            </div>
            {browserPlaybackError && (
              <p className="status-message error">{browserPlaybackError}</p>
            )}
            <video
              className="player-frame"
              controls
              key={selectedBrowserFile}
              onError={() =>
                setBrowserPlaybackError(
                  "The browser-safe copy could not be played. It may still be transcoding.",
                )
              }
              preload="metadata"
              src={toBrowserMediaUrl(selectedBrowserFile)}
            />
          </section>
        )}

        <ul className="file-list">
          {files.map((file) => (
            <li className="file-card" key={file}>
              <div className="file-name-row">
                <span>{file}</span>
              </div>
              <div className="file-actions">
                <button
                  className={
                    selectedBrowserFile === file ? "file-button active" : "file-button"
                  }
                  onClick={() => void playInBrowser(file)}
                  type="button"
                >
                  Browser
                </button>
                <button
                  className={
                    selectedNebulaFile === file ? "file-button active" : "file-button"
                  }
                  onClick={() => void playFile(file)}
                  type="button"
                >
                  Nebula
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
