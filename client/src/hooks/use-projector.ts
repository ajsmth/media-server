import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client, queryKeys } from "@/fetch-client";

export function useProjector() {
  const queryClient = useQueryClient();

  const adbStatusQuery = useQuery({
    queryKey: queryKeys.adbStatus,
    queryFn: () => client.getAdbStatus(),
    refetchInterval: 5000,
  });

  const connectAdbMutation = useMutation({
    mutationFn: () => client.connectAdb(),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.adbStatus, status);
    },
  });

  const launchVlcMutation = useMutation({
    mutationFn: () => client.launchVlc(),
  });

  return {
    adbStatus: adbStatusQuery.data ?? null,
    adbStatusQuery,
    connectAdbMutation,
    launchVlcMutation,
  };
}
