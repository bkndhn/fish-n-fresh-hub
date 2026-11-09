import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const URL = "https://fishnfresh.lovable.app/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Fish N Fresh" },
      { name: "description", content: "How Fish N Fresh collects, uses and protects your name, phone, address, order and payment information." },
      { property: "og:title", content: "Privacy Policy — Fish N Fresh" },
      { property: "og:description", content: "How we collect, use and protect your personal data." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { data: settings } = useQuery(settingsQuery);
  const store = settings?.store_name || "Fish N Fresh";
  const phone = settings?.support_phone || settings?.whatsapp_number || "";
  const address = settings?.store_address || "";
  const sections: [string, string][] = [
    ["What we collect", "Your name, phone number, email, delivery address and location (only when you share it), order history, and payment status. Card/UPI details are processed by our payment partner and never stored by us."],
    ["Why we use it", "To take and deliver orders, send order updates on SMS/WhatsApp/notifications, issue GST invoices, prevent fraud, and improve our service."],
    ["Sharing", "Only with the delivery partner handling your order, our payment processor, and authorities when legally required. We never sell your data."],
    ["Cookies & analytics", "We use essential storage to keep you signed in and remember your cart. With your consent we use privacy-friendly analytics to understand page usage. You can change this anytime by clearing site data."],
    ["Retention", "Order and invoice records are kept as required by Indian tax law (up to 8 years). Other data is deleted when you close your account."],
    ["Your rights", "Under the Digital Personal Data Protection Act, 2023 you may access, correct or erase your data and withdraw consent. Contact us below."],
    ["Security", "Data is encrypted in transit, access is restricted by role, and every database table is protected by row-level security."],
  ];
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl py-8 px-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
          <Link to="/"><ArrowLeft className="size-4" /> Back to Store</Link>
        </Button>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">{store} · Updated November 2026</p>
        <div className="space-y-6">
          {sections.map(([t, b]) => (
            <section key={t}>
              <h2 className="text-lg font-semibold mb-1">{t}</h2>
              <p className="text-muted-foreground leading-relaxed">{b}</p>
            </section>
          ))}
          <section>
            <h2 className="text-lg font-semibold mb-1">Contact</h2>
            <p className="text-muted-foreground">{store}{address && `, ${address}`}{phone && ` · ${phone}`}</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
