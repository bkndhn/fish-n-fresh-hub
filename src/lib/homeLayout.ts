/** Home page section order + visibility, saved in store_settings.home_layout. */
export type HomeSectionId =
  | "repeat_order"
  | "recent"
  | "pinned"
  | "collections"
  | "featured"
  | "deals"
  | "top_rated"
  | "bestsellers";

export type HomeSection = { id: HomeSectionId; enabled: boolean; title: string };
export type HomeLayout = {
  sections: HomeSection[];
  recentMode: "added" | "edited";
  recentDays: number;
  pinnedProductIds: string[];
};

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  repeat_order: "Repeat last order",
  recent: "Just added / updated",
  pinned: "Picked by us (pinned items)",
  collections: "Collections",
  featured: "Featured",
  deals: "Deals & discounts",
  top_rated: "Top rated",
  bestsellers: "Best sellers",
};

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  sections: [
    { id: "repeat_order", enabled: true, title: "Order again" },
    { id: "recent", enabled: true, title: "Fresh in today" },
    { id: "pinned", enabled: false, title: "Picked for you" },
    { id: "collections", enabled: true, title: "" },
    { id: "featured", enabled: true, title: "Featured" },
    { id: "deals", enabled: true, title: "Deals of the day" },
    { id: "top_rated", enabled: true, title: "Top customer rated" },
    { id: "bestsellers", enabled: true, title: "Best sellers" },
  ],
  recentMode: "added",
  recentDays: 14,
  pinnedProductIds: [],
};

/** Merge a saved (possibly partial/old) layout with defaults; unknown ids dropped, new ids appended. */
export function normalizeHomeLayout(raw: unknown): HomeLayout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<HomeLayout>;
  const known = new Map(DEFAULT_HOME_LAYOUT.sections.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const sections: HomeSection[] = [];
  for (const s of Array.isArray(r.sections) ? r.sections : []) {
    const def = s && known.get(s.id);
    if (!def || seen.has(s.id)) continue;
    seen.add(s.id);
    sections.push({ id: s.id, enabled: s.enabled !== false, title: typeof s.title === "string" ? s.title : def.title });
  }
  for (const d of DEFAULT_HOME_LAYOUT.sections) if (!seen.has(d.id)) sections.push({ ...d });
  const days = Number(r.recentDays);
  return {
    sections,
    recentMode: r.recentMode === "edited" ? "edited" : "added",
    recentDays: Number.isFinite(days) && days > 0 ? Math.min(days, 365) : DEFAULT_HOME_LAYOUT.recentDays,
    pinnedProductIds: Array.isArray(r.pinnedProductIds) ? r.pinnedProductIds.filter((x) => typeof x === "string") : [],
  };
}

export function moveSection(layout: HomeLayout, index: number, dir: -1 | 1): HomeLayout {
  const j = index + dir;
  if (j < 0 || j >= layout.sections.length) return layout;
  const sections = [...layout.sections];
  [sections[index], sections[j]] = [sections[j]!, sections[index]!];
  return { ...layout, sections };
}

type Stamped = { created_at?: string | null; updated_at?: string | null };
/** Newest first by added or edited date, limited to the last `days` days. */
export function recentProducts<T extends Stamped>(items: T[], mode: "added" | "edited", days: number, now = Date.now()): T[] {
  const key = mode === "edited" ? "updated_at" : "created_at";
  const cutoff = now - days * 86400000;
  return items
    .filter((p) => {
      const t = Date.parse(String(p[key] ?? ""));
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => Date.parse(String(b[key])) - Date.parse(String(a[key])));
}

/** Short pack-size label for a product card, e.g. "1 kg", "500 g", "1 pc". */
export function packSizeLabel(p: { unit?: string | null; min_order_qty?: number | null; step_qty?: number | null }): string | null {
  const unit = (p.unit || "").trim();
  if (!unit) return null;
  const q = Number(p.min_order_qty || 0);
  if (/^\d/.test(unit)) return unit;
  if (unit.toLowerCase() === "kg" && q > 0 && q < 1) return `${Math.round(q * 1000)} g`;
  return `${q > 0 && q !== 1 ? q : 1} ${unit}`;
}
