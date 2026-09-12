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
    defaultPreloadDelay: 0, // 0ms instantaneous hover/touch prefetching
    defaultPreloadStaleTime: 1000 * 60 * 15,
    defaultPendingMs: 1000, // Never show loading flicker for sub-second transitions
    defaultPendingMinMs: 400,
    defaultViewTransition: true,
  });

  return router;
};
