declare module "webtorrent" {
  import { EventEmitter } from "node:events";

  export type TorrentRemoveOptions = {
    destroyStore?: boolean;
  };

  export type TorrentAddOptions = {
    path?: string;
  };

  export type TorrentFile = {
    name: string;
    path: string;
    length: number;
    downloaded: number;
    progress: number;
    done: boolean;
  };

  export interface Torrent extends EventEmitter {
    infoHash: string;
    magnetURI: string;
    name: string;
    path: string;
    files: TorrentFile[];
    ready: boolean;
    done: boolean;
    progress: number;
    downloaded: number;
    length: number;
    downloadSpeed: number;
    once(event: "ready", listener: () => void): this;
    once(event: "metadata", listener: () => void): this;
    once(event: "done", listener: () => void): this;
    on(event: "download", listener: (downloadedBytes: number) => void): this;
    on(event: "done", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
  }

  export default class WebTorrent extends EventEmitter {
    add(
      torrentId: string,
      options?: TorrentAddOptions,
      onTorrent?: (torrent: Torrent) => void,
    ): Torrent;
    remove(
      torrentId: string | Torrent,
      options?: TorrentRemoveOptions,
      callback?: (error?: Error | null) => void,
    ): Promise<void>;
    destroy(callback?: (error?: Error | null) => void): void;
    on(event: "error", listener: (error: Error) => void): this;
  }
}
