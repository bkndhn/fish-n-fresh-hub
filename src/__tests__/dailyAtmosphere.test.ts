import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  getDailyAtmosphere,
  getDayOfYear,
  isDailyAtmosphereEnabled,
  setDailyAtmosphereEnabled,
} from "@/lib/dailyAtmosphere";

describe("Daily Coastal Atmosphere & Mood Engine", () => {
  const store: Record<string, string> = {};

  beforeAll(() => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    });
    vi.stubGlobal("window", {
      dispatchEvent: () => true,
    });
    vi.stubGlobal("CustomEvent", class {
      type: string;
      detail: any;
      constructor(type: string, opts?: any) {
        this.type = type;
        this.detail = opts?.detail;
      }
    });
  });

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("calculates accurate day of year and IST date representation", () => {
    const jan1 = new Date(Date.UTC(2026, 0, 1, 6, 0, 0));
    const info = getDayOfYear(jan1);
    expect(info.year).toBe(2026);
    expect(info.dayOfYear).toBe(1);
    expect(info.dateStr).toBe("2026-01-01");
  });

  it("procedurally generates deterministic daily atmosphere with accessible colors", () => {
    const today = new Date(Date.UTC(2026, 8, 11, 6, 0, 0));
    const atmosphere = getDailyAtmosphere(today);

    expect(atmosphere.id).toMatch(/^atmosphere-\d+-\d+$/);
    expect(atmosphere.name).toBeTruthy();
    expect(atmosphere.emoji).toBeTruthy();
    expect(atmosphere.subtitle).toBeTruthy();
    expect(atmosphere.primaryHex).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(atmosphere.primaryDarkHex).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(atmosphere.primaryLightOklch).toContain("oklch(");
    expect(atmosphere.primaryDarkOklch).toContain("oklch(");
    expect(atmosphere.glowGradient).toContain("radial-gradient(");
  });

  it("generates distinct atmospheres for consecutive days", () => {
    const day1 = new Date(Date.UTC(2026, 8, 11, 6, 0, 0));
    const day2 = new Date(Date.UTC(2026, 8, 12, 6, 0, 0));

    const mood1 = getDailyAtmosphere(day1);
    const mood2 = getDailyAtmosphere(day2);

    expect(mood1.dateStr).not.toBe(mood2.dateStr);
    expect(mood1.id).not.toBe(mood2.id);
  });

  it("respects default true and persists user/admin preference", () => {
    expect(isDailyAtmosphereEnabled()).toBe(true);

    setDailyAtmosphereEnabled(false);
    expect(isDailyAtmosphereEnabled()).toBe(false);

    setDailyAtmosphereEnabled(true);
    expect(isDailyAtmosphereEnabled()).toBe(true);
  });
});
