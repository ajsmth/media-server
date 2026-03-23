import { useQuery } from "@tanstack/react-query";
import type { PlaybackHistoryResponse } from "@media-server/shared";

import { client, queryKeys } from "@/fetch-client";

const EMPTY_PLAYBACK_HISTORY: PlaybackHistoryResponse = {
  continueWatching: [],
  recentlyFinished: [],
};

export function usePlaybackHistory() {
  const playbackHistoryQuery = useQuery({
    queryKey: queryKeys.playbackHistory,
    queryFn: () => client.getPlaybackHistory(),
    refetchInterval: 5000,
  });

  return {
    playbackHistory: playbackHistoryQuery.data ?? EMPTY_PLAYBACK_HISTORY,
    playbackHistoryQuery,
  };
}
