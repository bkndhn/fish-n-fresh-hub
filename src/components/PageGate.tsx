import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EyeOff } from "lucide-react";
import { disabledPagesQuery, isPathDisabled } from "@/lib/pageVisibility";

/** Blocks any page the store owner has switched off, for every role. */
export function PageGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQuery(disabledPagesQuery);
  if (!isPathDisabled(pathname, data)) return <>{children}</>;
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <EyeOff className="size-6 text-muted-foreground" />
      </div>
      <h1 className="font-display text-xl font-bold text-foreground">This page is turned off</h1>
      <p className="text-sm text-muted-foreground">This service isn't available for this store right now.</p>
      <Link to="/" className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Back to home
      </Link>
    </div>
  );
}
