import { useQuery } from '@tanstack/react-query';
import { searchUsers } from '@/api/users';
import { queryKeys } from '@/api/queryKeys';
import { useDebounce } from './useDebounce';

/** Debounced user directory search. */
export function useUserSearch(term: string) {
  const debounced = useDebounce(term.trim(), 300);
  return useQuery({
    queryKey: queryKeys.userSearch(debounced),
    queryFn: () => searchUsers(debounced),
    enabled: debounced.length >= 2,
    staleTime: 15_000,
  });
}
