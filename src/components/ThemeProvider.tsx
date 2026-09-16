import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import {
  applyDailyAtmosphere,
  isDailyAtmosphereEnabled,
  updateStatusBarColor,
} from "@/lib/dailyAtmosphere";

import { getStoreVertical } from "@/lib/verticals";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  const { data: settings } = useQuery(settingsQuery);

  // Read the stored preference after hydration (localStorage is browser-only).
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored) setThemeState(stored);
  }, [storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
  
  // Apply dynamic brand theme color, daily atmosphere, favicon, and status bar color
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Dynamic Favicon Update: prefer custom logo if provided, otherwise default to generated master favicon
    let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    if (settings?.logo_url) {
      favicon.href = settings.logo_url;
    } else {
      favicon.href = "/favicon.ico";
    }

    const syncColors = () => {
      const isDark = root.classList.contains("dark");
      const vertical = getStoreVertical(settings);
      const storeName = settings?.store_name?.trim() || "Fish N Fresh Hub";
      const customThemeColor = settings?.theme_color?.trim();
      const effectiveThemeColor = customThemeColor || vertical.recommendedThemeColor || "#0284c7";
      const dailyEnabled = settings ? isDailyAtmosphereEnabled(settings) : false;

      // Update PWA / mobile app meta names based on store name
      const appNameMeta = document.querySelector("meta[name='application-name']");
      if (appNameMeta) appNameMeta.setAttribute("content", storeName);

      const appleTitleMeta = document.querySelector("meta[name='apple-mobile-web-app-title']");
      if (appleTitleMeta) appleTitleMeta.setAttribute("content", storeName);

      const appleStatusMeta = document.querySelector("meta[name='apple-mobile-web-app-status-bar-style']");
      if (appleStatusMeta) appleStatusMeta.setAttribute("content", isDark ? "black-translucent" : "default");

      if (dailyEnabled) {
        // Procedural daily atmosphere theme (different every single day)
        applyDailyAtmosphere(true, isDark);
      } else {
        // Static brand theme color or vertical recommended theme color
        applyDailyAtmosphere(false, isDark);
        root.style.setProperty("--primary", effectiveThemeColor);
        root.style.setProperty("--ring", effectiveThemeColor);

        // Compute high-contrast primary foreground (WCAG compliant)
        const hex = effectiveThemeColor.replace("#", "").trim();
        let yiq = 0;
        if (hex.length === 3) {
          const c0 = hex[0] ?? "0";
          const c1 = hex[1] ?? "0";
          const c2 = hex[2] ?? "0";
          const r = parseInt(c0 + c0, 16);
          const g = parseInt(c1 + c1, 16);
          const b = parseInt(c2 + c2, 16);
          yiq = (r * 299 + g * 587 + b * 114) / 1000;
        } else if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          yiq = (r * 299 + g * 587 + b * 114) / 1000;
        }
        const contrastFg = yiq >= 150 ? "#0f172a" : "#ffffff";
        root.style.setProperty("--primary-foreground", contrastFg);

        updateStatusBarColor(effectiveThemeColor, isDark ? "#0b1120" : effectiveThemeColor);
      }
    };

    syncColors();

    const onAtmosphereChanged = () => syncColors();
    window.addEventListener("daily-atmosphere-changed", onAtmosphereChanged);
    return () => {
      window.removeEventListener("daily-atmosphere-changed", onAtmosphereChanged);
    };
  }, [settings?.theme_color, settings?.business_vertical, settings?.store_name, settings?.logo_url, (settings as import("@/lib/types").SiteSettings & { daily_atmosphere_enabled?: boolean })?.daily_atmosphere_enabled, theme]);

  const value = {
    theme,
    setTheme: (next: Theme) => {
      localStorage.setItem(storageKey, next);
      setThemeState(next);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
