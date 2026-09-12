import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import {
  applyDailyAtmosphere,
  isDailyAtmosphereEnabled,
  updateStatusBarColor,
} from "@/lib/dailyAtmosphere";

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
      const dailyEnabled = settings ? isDailyAtmosphereEnabled(settings) : false;

      if (dailyEnabled) {
        // Procedural daily atmosphere theme (different every single day)
        applyDailyAtmosphere(true, isDark);
      } else if (settings?.theme_color) {
        // Static brand theme color configured by store admin
        applyDailyAtmosphere(false, isDark);
        root.style.setProperty("--primary", settings.theme_color);
        root.style.setProperty("--ring", settings.theme_color);
        updateStatusBarColor(isDark ? "#0b1120" : settings.theme_color);
      } else {
        // Classic Ocean theme
        applyDailyAtmosphere(false, isDark);
      }
    };

    syncColors();

    const onAtmosphereChanged = () => syncColors();
    window.addEventListener("daily-atmosphere-changed", onAtmosphereChanged);
    return () => {
      window.removeEventListener("daily-atmosphere-changed", onAtmosphereChanged);
    };
  }, [settings?.theme_color, settings?.logo_url, (settings as import("@/lib/types").SiteSettings & { daily_atmosphere_enabled?: boolean })?.daily_atmosphere_enabled, theme]);

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
