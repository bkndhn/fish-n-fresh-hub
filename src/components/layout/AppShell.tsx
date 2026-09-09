import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "../WhatsAppIcon";
import { SiteHeader } from "./SiteHeader";
import { CatchAlertBanner } from "../CatchAlertBanner";
import { BottomNav } from "./BottomNav";
import { FloatingCart } from "../FloatingCart";
import { PwaPrompt } from "../PwaPrompt";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: settings } = useQuery(settingsQuery);
  const waNumber = settings?.whatsapp_number || settings?.support_phone;
  const waUrl = waNumber
    ? getWhatsAppUrl(
        waNumber,
        `Hi ${settings?.store_name || "Fish N Fresh"}, I'd like to inquire about today's fresh seafood catch!`
      )
    : null;

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden flex flex-col">
      <PwaPrompt />
      <CatchAlertBanner />
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-3 sm:px-4 pt-3 sm:pt-4 flex-1 overflow-x-hidden">{children}</main>
      <Footer />
      <FloatingCart />
      <BottomNav />

      {/* Floating WhatsApp Speed-Dial Widget */}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-[#25D366] text-white p-3 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group"
          title="Chat with us on WhatsApp"
        >
          <WhatsAppIcon className="size-6 shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-bold transition-all duration-300 group-hover:max-w-xs group-hover:pr-1">
            Chat on WhatsApp
          </span>
          <span className="absolute -top-1 -right-1 flex size-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-3 bg-emerald-500" />
          </span>
        </a>
      )}
    </div>
  );
}

