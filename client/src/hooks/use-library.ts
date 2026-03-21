import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LibraryCatalogSnapshot,
  TorrentDownloadRecord,
} from "@media-server/shared";

import { client, queryKeys } from "@/fetch-client";

export const EMPTY_LIBRARY: LibraryCatalogSnapshot = {
  generatedAt: new Date(0).toISOString(),
  lastScanAt: null,
  movies: [],
  shows: [],
  otherVideos: [],
};

export function useLibrary() {
  const queryClient = useQueryClient();

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

  const rescanLibraryMutation = useMutation({
    mutationFn: () => client.rescanLibrary(),
    onSuccess: async (snapshot) => {
      queryClient.setQueryData(queryKeys.library, snapshot);
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStatus });
    },
  });

  const onTorrentImported = (download: TorrentDownloadRecord) => {
    queryClient.setQueryData(
      queryKeys.torrents,
      (currentDownloads: TorrentDownloadRecord[] = []) => [
        download,
        ...currentDownloads,
      ],
    );

    return queryClient.invalidateQueries({ queryKey: queryKeys.library });
  };

  return {
    library: libraryQuery.data ?? EMPTY_LIBRARY,
    libraryQuery,
    libraryStatus: libraryStatusQuery.data ?? null,
    libraryStatusQuery,
    rescanLibraryMutation,
    onTorrentImported,
  };
}
