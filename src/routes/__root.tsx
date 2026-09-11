import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/lib/cart";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" },
      { title: "Fish N Fresh Hub — Dock Fresh Seafood & Premium Meat" },
      { name: "description", content: "Kasimedu Dock Fresh Seafood & Premium Meat delivered in 35 minutes. Chemical-free, ice-packed, and 100% fresh." },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#0284c7" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#0b1120" },
      { name: "theme-color", content: "#0284c7" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Fish N Fresh" },
      { name: "application-name", content: "Fish N Fresh" },
      { property: "og:title", content: "Fish N Fresh Hub — Fresh Seafood & Meat" },
      { property: "og:description", content: "Order fresh ocean catch & farm meat delivered fast with live order PIN and driver tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      {
        name: "googlebot",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // favicon — real logo PNG (browsers accept PNG as .ico)
      { rel: "icon", href: "/favicon.ico", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", href: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
      // iOS Safari home screen icon — dedicated 180x180 file (no letter, real logo)
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://images.unsplash.com" },
      { rel: "dns-prefetch", href: "https://images.unsplash.com" },
      { rel: "preconnect", href: "https://avajyfqrmoputglbrmhm.supabase.co" },
      { rel: "dns-prefetch", href: "https://avajyfqrmoputglbrmhm.supabase.co" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__pwaInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaInstallPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
              });
              window.addEventListener('appinstalled', function() {
                window.__pwaInstallPrompt = null;
                try { localStorage.setItem('fnf_pwa_installed', 'true'); } catch(e) {}
                window.dispatchEvent(new CustomEvent('pwa-app-installed'));
              });
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { LanguageProvider } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

function RealtimeSubscriber({ queryClient }: { queryClient: any }) {
  useEffect(() => {
    const channel = supabase
      .channel("public-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          console.log("Products changed, invalidating cache...");
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_settings" },
        () => {
          console.log("Settings changed, invalidating cache...");
          queryClient.invalidateQueries({ queryKey: ["store_settings"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "customer_suspensions" },
        async (payload) => {
          const phone = localStorage.getItem("fnf_phone");
          if (payload.new && phone && payload.new['phone'] === phone) {
            await supabase.auth.signOut();
            localStorage.removeItem("fnf_phone");
            window.location.href = "/";
            alert("Your account has been suspended. Please contact support.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}

import { ThemeProvider } from "@/components/ThemeProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SeoStructuredData } from "@/components/SeoStructuredData";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn("PWA Service Worker note:", err);
        });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="fnf-theme">
        <LanguageProvider>
          <CartProvider>
            <OfflineBanner />
            <SeoStructuredData />
            <AnalyticsTracker />
            <RealtimeSubscriber queryClient={queryClient} />
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
            <Toaster position="top-center" />
          </CartProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
