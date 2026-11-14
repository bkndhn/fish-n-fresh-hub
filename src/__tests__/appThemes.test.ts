import { describe, it, expect } from "vitest";
import { themeForColor, APP_THEMES } from "@/lib/appThemes";

describe("app themes", () => {
  it("defaults to Sky Sea when no colour is saved", () => {
    expect(themeForColor(null)?.id).toBe("sky-sea");
    expect(APP_THEMES[0]!.id).toBe("sky-sea");
  });
  it("matches saved preset colour case-insensitively", () => {
    expect(themeForColor("#06B6D4")?.id).toBe("midnight-sea");
  });
  it("returns null for a custom colour", () => {
    expect(themeForColor("#123456")).toBeNull();
  });
});
