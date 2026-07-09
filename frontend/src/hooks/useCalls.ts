import { useQuery } from '@tanstack/react-query';
import { getCallHistory } from '@/api/calls';
import { queryKeys } from '@/api/queryKeys';

/** The user's call log (incoming/outgoing/missed), newest first. */
export function useCallHistory() {
  return useQuery({
    queryKey: queryKeys.calls,
    queryFn: getCallHistory,
  });
}
