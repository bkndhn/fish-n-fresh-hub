import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { Truck, Gift, CalendarDays, Copy } from "lucide-react";
import { toast } from "sonner";

const URL = "https://fishnfresh.lovable.app/offers";
// Free-delivery days of the week (0 = Sunday). Edit here when the offer changes.
export const FREE_DELIVERY_WEEKDAYS = [0, 3];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Launch Offer — Free Delivery Days | Fish N Fresh" },
      { name: "description", content: "Fish N Fresh launch offer: low delivery charge, free delivery on big orders and free-delivery days every week." },
      { property: "og:title", content: "Launch Offer — Fish N Fresh" },
      { property: "og:description", content: "Free delivery days and low delivery charges on fresh seafood." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: OffersPage,
});

function OffersPage() {
  const { data: settings } = useQuery(settingsQuery);
  const s = settings as Record<string, unknown> | undefined;
  const fee = Number(s?.base_delivery_fee ?? s?.delivery_fee ?? 40);
  const freeOver = Number(s?.free_delivery_over ?? 499);
  const today = new Date().getDay();
  const freeToday = FREE_DELIVERY_WEEKDAYS.includes(today);

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground shadow-lg">
        <p className="text-xs font-bold uppercase tracking-widest opacity-90">Launch Offer</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold">Fresh seafood, delivered for less</h1>
        <p className="mt-2 text-sm opacity-90">
          {freeToday ? "Today is a free-delivery day! 🎉" : `Next free-delivery day: ${DAY_NAMES[FREE_DELIVERY_WEEKDAYS.find((d) => d > today) ?? FREE_DELIVERY_WEEKDAYS[0]!]}`}
        </p>
        <Button asChild variant="secondary" className="mt-4 rounded-xl font-bold">
          <Link to="/catalog">Shop now</Link>
        </Button>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <Truck className="size-6 text-primary" />
          <p className="mt-2 font-bold">Delivery charge</p>
          <p className="text-2xl font-extrabold text-primary">{inr(fee)}</p>
          <p className="text-xs text-muted-foreground">per order</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <Gift className="size-6 text-primary" />
          <p className="mt-2 font-bold">Free delivery</p>
          <p className="text-2xl font-extrabold text-primary">Over {inr(freeOver)}</p>
          <p className="text-xs text-muted-foreground">every day</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <CalendarDays className="size-6 text-primary" />
          <p className="mt-2 font-bold">Free-delivery days</p>
          <p className="text-lg font-extrabold text-primary">{FREE_DELIVERY_WEEKDAYS.map((d) => DAY_NAMES[d]).join(" & ")}</p>
          <p className="text-xs text-muted-foreground">any order size</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Mention this code on WhatsApp orders</p>
          <p className="font-mono text-lg font-extrabold text-primary">LAUNCH</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard?.writeText("LAUNCH"); toast.success("Code copied"); }}>
          <Copy className="size-4" /> Copy
        </Button>
      </div>
    </AppShell>
  );
}
