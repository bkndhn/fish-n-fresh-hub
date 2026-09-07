import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";

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
  
  // Apply dynamic brand theme color and favicon
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Dynamic Favicon Update
    let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    // If settings has logo, use it. Otherwise, use an SVG fish emoji as default
    favicon.href = settings?.logo_url || "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐟</text></svg>";

    if (settings?.theme_color) {
      root.style.setProperty("--primary", settings.theme_color);
      
      // Also update meta theme-color for status bar
      let metaThemeColor = document.querySelector("meta[name='theme-color']");
      if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute("content", settings.theme_color);
    } else {
      root.style.removeProperty("--primary");
      
      const isDark = root.classList.contains("dark");
      let metaThemeColor = document.querySelector("meta[name='theme-color']");
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", isDark ? "#000000" : "#ffffff");
      }
    }

    // Dynamic Manifest for PWA App Icon
    const manifestUrl = URL.createObjectURL(new Blob([JSON.stringify({
      name: "Fish N Fresh",
      short_name: "FishNFresh",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: settings?.theme_color || "#0ea5e9",
      icons: [
        {
          src: settings?.logo_url || favicon.href,
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: settings?.logo_url || favicon.href,
          sizes: "512x512",
          type: "image/png"
        }
      ]
    })], { type: 'application/json' }));

    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;

  }, [settings?.theme_color, settings?.logo_url, theme]);

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
