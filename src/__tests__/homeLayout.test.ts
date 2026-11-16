import { describe, it, expect } from "vitest";
import { normalizeHomeLayout, moveSection, recentProducts, packSizeLabel, DEFAULT_HOME_LAYOUT } from "@/lib/homeLayout";

describe("home layout", () => {
  it("fills missing sections and keeps saved order", () => {
    const l = normalizeHomeLayout({ sections: [{ id: "bestsellers", enabled: false, title: "Hot" }] });
    expect(l.sections[0]).toEqual({ id: "bestsellers", enabled: false, title: "Hot" });
    expect(l.sections).toHaveLength(DEFAULT_HOME_LAYOUT.sections.length);
  });
  it("moves a section up", () => {
    const l = moveSection(DEFAULT_HOME_LAYOUT, 1, -1);
    expect(l.sections[0]!.id).toBe("recent");
  });
  it("recently edited sorts newest first and drops old", () => {
    const now = Date.parse("2026-11-15T00:00:00Z");
    const r = recentProducts(
      [
        { id: "a", updated_at: "2026-11-10T00:00:00Z" },
        { id: "b", updated_at: "2026-11-14T00:00:00Z" },
        { id: "c", updated_at: "2026-09-01T00:00:00Z" },
      ],
      "edited", 14, now,
    );
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("pack size for half-kilo minimum", () => {
    expect(packSizeLabel({ unit: "kg", min_order_qty: 0.5 })).toBe("500 g");
  });
});
