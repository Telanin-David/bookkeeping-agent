import { QueryClient } from '@tanstack/react-query';

// One shared client, so signing out can wipe every cached query — otherwise the next
// person to sign in on this device briefly sees the previous owner's data.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});
