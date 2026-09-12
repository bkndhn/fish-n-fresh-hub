import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import type { SiteSettings } from "@/lib/types";

export function AnalyticsTracker() {
  const { data: settings } = useQuery(settingsQuery);

  useEffect(() => {
    if (typeof window === "undefined" || !settings) return;
    const s = settings as SiteSettings;

    // 1. Google Analytics 4 (GA4) Injection
    const gaId = s.ga4_measurement_id;
    if (gaId && gaId.trim() && !document.getElementById("ga4-script")) {
      const script = document.createElement("script");
      script.id = "ga4-script";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId.trim())}`;
      document.head.appendChild(script);

      const initScript = document.createElement("script");
      initScript.id = "ga4-init";
      initScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId.trim()}');
      `;
      document.head.appendChild(initScript);
    }

    // 2. Meta (Facebook) Pixel Injection
    const pixelId = s.meta_pixel_id;
    if (pixelId && pixelId.trim() && !document.getElementById("meta-pixel-script")) {
      const pixelScript = document.createElement("script");
      pixelScript.id = "meta-pixel-script";
      pixelScript.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId.trim()}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(pixelScript);
    }
  }, [settings]);

  return null;
}
