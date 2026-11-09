import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "fnf-cookie-consent";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY) && !location.pathname.startsWith("/admin")) setShow(true);
    } catch { /* storage blocked */ }
  }, []);
  if (!show) return null;
  const decide = (v: "all" | "essential") => {
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
    setShow(false);
  };
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-3 bottom-20 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm z-[60] rounded-2xl border border-border bg-card text-card-foreground shadow-xl p-4">
      <p className="text-sm text-muted-foreground">
        We use essential storage for your cart and sign-in, and optional analytics to improve the shop.{" "}
        <Link to="/privacy" className="underline text-primary">Privacy Policy</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => decide("all")}>Accept</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => decide("essential")}>Essential only</Button>
      </div>
    </div>
  );
}

export function hasAnalyticsConsent() {
  try { return localStorage.getItem(KEY) !== "essential"; } catch { return true; }
}
