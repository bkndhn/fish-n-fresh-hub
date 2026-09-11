import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { activeBranchesQuery, resolveBranchBySlug } from "@/lib/multiBranch";
import { useCustomerBranch } from "@/lib/customerBranchContext";
import { toast } from "sonner";
import { Store, Loader2 } from "lucide-react";

export const Route = createFileRoute("/branch/$slug")({
  component: BranchRedirectPage,
});

function BranchRedirectPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { setActiveBranch } = useCustomerBranch();
  const { data: branches = [], isLoading } = useQuery(activeBranchesQuery);

  useEffect(() => {
    if (isLoading || !branches.length) return;

    const matched = resolveBranchBySlug(branches, slug);
    if (matched) {
      setActiveBranch(matched);
      try {
        localStorage.setItem("fnf_customer_branch_slug", matched.slug);
      } catch {
        /* ignore */
      }
      toast.success(`Welcome to ${matched.name}!`, {
        description: `Now shopping dock-fresh harvest from ${matched.name} (${matched.delivery_radius_km} km delivery zone).`,
      });
    } else {
      toast.error(`Branch "${slug}" was not found. Defaulting to main hub.`);
    }

    // Redirect to home/catalog
    navigate({ to: "/" });
  }, [slug, branches, isLoading, setActiveBranch, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="text-center space-y-3">
        <div className="mx-auto size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Store className="size-6 animate-pulse" />
        </div>
        <h2 className="text-base font-bold text-foreground">Connecting to Store Hub...</h2>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Setting up local hub catalog for "{slug}"</span>
        </p>
      </div>
    </div>
  );
}
