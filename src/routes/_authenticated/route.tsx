import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Fast in-memory cache for authenticated session user to provide instant 0ms transitions
let cachedUser: any = null;
let lastCheckTime = 0;
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes fresh in-memory

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 0ms synchronous local session lookup
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user;

    if (!sessionUser) {
      cachedUser = null;
      lastCheckTime = 0;
      throw redirect({ to: "/auth" });
    }

    const now = Date.now();
    if (cachedUser && cachedUser.id === sessionUser.id && (now - lastCheckTime) < USER_CACHE_TTL) {
      return { user: cachedUser };
    }

    cachedUser = sessionUser;
    lastCheckTime = now;
    return { user: cachedUser };
  },
  component: () => <Outlet />,
});

