import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { settingsQuery } from "@/lib/queries";
import { getStoreVertical, getVerticalSearchPlaceholder } from "@/lib/verticals";

/** Home-page search; same look as Catalog, opens Catalog with results. */
export function HomeSearchBar() {
  const navigate = useNavigate();
  const { data: settings } = useQuery(settingsQuery);
  const vertical = getStoreVertical(settings);
  const [q, setQ] = useState("");
  const submit = () => {
    const term = q.trim();
    navigate({ to: "/catalog", search: term ? { q: term } : {} } as any);
  };
  return (
    <form
      role="search"
      className="relative mb-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Search products"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={getVerticalSearchPlaceholder(vertical.id, settings?.store_name ?? undefined)}
        className="pl-10 pr-10 h-11 rounded-2xl bg-card border-border shadow-xs text-sm"
      />
      {q && (
        <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      )}
    </form>
  );
}
