import type {
  AdbStatus,
  CreateTorrentRequestBody,
  EncodeLibraryFileResponse,
  ErrorResponse,
  LaunchVlcResponse,
  LibraryCatalogSnapshot,
  LibraryCatalogStatus,
  PlayRequestBody,
  PlayResponse,
  TorrentDownloadRecord,
} from "@media-server/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as ErrorResponse;
    return payload.error ?? fallbackMessage;
  }

  const text = (await response.text()).trim();
  return text || fallbackMessage;
}

async function request<TResponse>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<TResponse> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new ApiError(
      await readErrorMessage(response, fallbackMessage),
      response.status,
    );
  }

  return (await response.json()) as TResponse;
}

async function requestVoid(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
): Promise<void> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new ApiError(
      await readErrorMessage(response, fallbackMessage),
      response.status,
    );
  }
}

export const queryKeys = {
  library: ["library"] as const,
  libraryStatus: ["library-status"] as const,
  adbStatus: ["adb-status"] as const,
  torrents: ["torrents"] as const,
};

function jsonRequestInit(body: unknown): RequestInit {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

export const client = {
  getLibrary(): Promise<LibraryCatalogSnapshot> {
    return request("/api/library", undefined, "Unable to load the media library from the backend.");
  },

  getLibraryStatus(): Promise<LibraryCatalogStatus> {
    return request("/api/library/status", undefined, "Unable to load library scan status.");
  },

  getAdbStatus(): Promise<AdbStatus> {
    return request("/api/adb/status", undefined, "Unable to load projector connection status.");
  },

  getTorrents(): Promise<TorrentDownloadRecord[]> {
    return request("/api/torrents", undefined, "Unable to load torrent activity from the backend.");
  },

  playFile(fileId: string): Promise<PlayResponse> {
    const body: PlayRequestBody = { fileId };

    return request(
      "/api/play",
      {
        method: "POST",
        ...jsonRequestInit(body),
      },
      "Failed to launch VLC",
    );
  },

  launchVlc(): Promise<LaunchVlcResponse> {
    return request(
      "/api/vlc/launch",
      { method: "POST" },
      "Failed to launch VLC",
    );
  },

  rescanLibrary(): Promise<LibraryCatalogSnapshot> {
    return request(
      "/api/library/rescan",
      { method: "POST" },
      "Failed to rescan library",
    );
  },

  startTorrent(magnetLink: string): Promise<TorrentDownloadRecord> {
    const body: CreateTorrentRequestBody = { magnetLink };

    return request(
      "/api/torrents",
      {
        method: "POST",
        ...jsonRequestInit(body),
      },
      "Failed to start torrent download",
    );
  },

  cancelTorrent(id: string): Promise<TorrentDownloadRecord> {
    return request(
      `/api/torrents/${id}`,
      { method: "DELETE" },
      "Failed to cancel torrent download",
    );
  },

  connectAdb(): Promise<AdbStatus> {
    return request(
      "/api/adb/connect",
      { method: "POST" },
      "Unable to connect to projector",
    );
  },

  ensureBrowserReady(browserUrl: string): Promise<void> {
    return requestVoid(
      browserUrl,
      { method: "HEAD" },
      "Browser-ready copy is not available yet.",
    );
  },

  encodeLibraryFile(fileId: string): Promise<EncodeLibraryFileResponse> {
    return request(
      `/api/library/files/${fileId}/encode`,
      { method: "POST" },
      "Failed to queue browser encoding",
    );
  },
};
