import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export type CategoryItem = {
  id: string;
  name: string;
  sort_order?: number | null;
  image_url?: string | null;
};

interface StickyCategoryBarProps {
  categories: CategoryItem[];
  selectedCategory?: string | null | undefined;
  onSelectCategory: (categoryName: string | undefined) => void;
  allLabel?: string | undefined;
  className?: string | undefined;
}

export function StickyCategoryBar({
  categories,
  selectedCategory,
  onSelectCategory,
  allLabel = "All Items",
  className = "",
}: StickyCategoryBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  const sortedCategories = [...(categories ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  // Auto-scroll active category into visible view horizontally
  useEffect(() => {
    if (activeBtnRef.current && containerRef.current) {
      activeBtnRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [selectedCategory]);

  return (
    <nav
      aria-label="Category Navigation"
      className={`sticky top-14 z-30 w-full max-w-full overflow-x-clip bg-background/95 backdrop-blur-md border-b border-border/60 py-2 transition-all duration-200 shadow-2xs ${className}`}
    >
      <div
        ref={containerRef}
        className="mx-auto flex max-w-5xl items-center gap-1.5 overflow-x-auto px-3 sm:px-4 no-scrollbar scrollbar-none touch-pan-x"
        onWheel={(e) => {
          if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        {/* All Category Pill */}
        <button
          type="button"
          ref={!selectedCategory ? activeBtnRef : null}
          onClick={() => onSelectCategory(undefined)}
          className={`group flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95 cursor-pointer ${
            !selectedCategory
              ? "bg-primary text-primary-foreground font-bold shadow-xs ring-1 ring-primary/40"
              : "bg-card/80 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80"
          }`}
        >
          <span
            className={`size-1.5 rounded-full transition-colors ${
              !selectedCategory ? "bg-primary-foreground" : "bg-muted-foreground/50 group-hover:bg-primary"
            }`}
          />
          <span>{allLabel}</span>
        </button>

        {/* Individual Category Pills */}
        {sortedCategories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.id}
              type="button"
              ref={isSelected ? activeBtnRef : null}
              onClick={() => onSelectCategory(cat.name)}
              className={`group flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-200 active:scale-95 cursor-pointer ${
                isSelected
                  ? "bg-primary text-primary-foreground font-bold shadow-xs ring-1 ring-primary/40"
                  : "bg-card/80 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80"
              }`}
            >
              <span
                className={`size-1.5 rounded-full transition-colors ${
                  isSelected ? "bg-primary-foreground" : "bg-muted-foreground/50 group-hover:bg-primary"
                }`}
              />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
