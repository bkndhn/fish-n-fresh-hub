import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 10, // 10 minutes fresh in-memory cache (instant 0ms response)
        gcTime: 1000 * 60 * 60 * 24, // 24 hours persistence
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: "offlineFirst", // Instantly display cached data offline or online without blocking
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 20, // Ultra-responsive 20ms hover prefetching
    defaultPreloadStaleTime: 1000 * 60 * 10,
    defaultPendingMs: 50,
  });

  return router;
};
