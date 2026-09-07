import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { BottomNav } from "./BottomNav";
import { FloatingCart } from "../FloatingCart";
import { PwaPrompt } from "../PwaPrompt";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PwaPrompt />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pt-4">{children}</main>
      <Footer />
      <FloatingCart />
      <BottomNav />
    </div>
  );
}
