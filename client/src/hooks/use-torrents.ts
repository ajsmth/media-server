import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TorrentDownloadRecord } from "@media-server/shared";

import { client, queryKeys } from "@/fetch-client";

export function useTorrents() {
  const queryClient = useQueryClient();

  const torrentsQuery = useQuery({
    queryKey: queryKeys.torrents,
    queryFn: () => client.getTorrents(),
    refetchInterval: 2000,
  });

  const startTorrentMutation = useMutation({
    mutationFn: (magnetLink: string) => client.startTorrent(magnetLink),
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

  return {
    downloads: torrentsQuery.data ?? [],
    torrentsQuery,
    startTorrentMutation,
    cancelTorrentMutation,
  };
}
