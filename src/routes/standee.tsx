import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Clock, MapPin, MessageCircle, Printer, Phone } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { settingsQuery } from "@/lib/queries";

const STORE_URL = "https://fishnfresh.lovable.app";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Route = createFileRoute("/standee")({
  head: () => ({
    meta: [
      { title: "Visit Fish N Fresh — Address, Hours & WhatsApp Ordering" },
      { name: "description", content: "Fish N Fresh shop address in Tirupur, opening hours, WhatsApp ordering link and a scan-to-order QR code." },
      { property: "og:title", content: "Visit Fish N Fresh — Address, Hours & WhatsApp" },
      { property: "og:description", content: "Find our fish shop, see opening hours and order on WhatsApp in one tap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${STORE_URL}/standee` }],
  }),
  component: StandeePage,
});

function fmt(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hh = ((h! + 11) % 12) + 1;
  return `${hh}:${String(m ?? 0).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
}

function StandeePage() {
  const { data: s } = useQuery(settingsQuery);
  const [table, setTable] = useState("");
  const [qr, setQr] = useState("");
  const url = table ? `${STORE_URL}/table/${encodeURIComponent(table)}` : STORE_URL;
  useEffect(() => {
    QRCode.toDataURL(url, { width: 800, margin: 1, errorCorrectionLevel: "H" }).then(setQr);
  }, [url]);

  const name = s?.store_name || "Fish N Fresh";
  const address = s?.store_address || s?.address_line || "";
  const wa = String(s?.whatsapp_order_phone || s?.whatsapp_number || "").replace(/\D/g, "");
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${name}, I'd like to order`)}` : "";
  const days = Array.isArray(s?.working_days) ? (s!.working_days as number[]) : [0, 1, 2, 3, 4, 5, 6];
  const closed = DAYS.filter((_, i) => !days.includes(i));
  const mapLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-md print:max-w-none">
        <div className="standee-card rounded-3xl border-2 border-primary bg-card p-6 text-center shadow-lg print:shadow-none">
          {s?.logo_url && <img src={s.logo_url} alt={`${name} logo`} className="mx-auto mb-2 size-16 rounded-2xl object-cover" />}
          <h1 className="text-2xl font-extrabold text-primary">{name}</h1>
          {s?.tagline && <p className="text-sm text-muted-foreground">{s.tagline}</p>}
          <p className="mt-3 text-sm font-bold">Scan to order fresh seafood{table ? ` · Table ${table}` : ""}</p>
          {qr && <img src={qr} alt="Scan to order QR code" className="mx-auto my-3 w-56 rounded-xl" />}
          <div className="space-y-2 text-left text-sm">
            {address && (
              <a href={mapLink} target="_blank" rel="noreferrer" className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{address}</a>
            )}
            <p className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              {fmt(s?.open_time) || "—"} – {fmt(s?.close_time) || "—"}{closed.length ? ` · Closed ${closed.join(", ")}` : " · Open all days"}
            </p>
            {s?.contact_phone && <a href={`tel:${s.contact_phone}`} className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-primary" />{s.contact_phone}</a>}
          </div>
          {waLink && (
            <Button asChild className="mt-4 w-full rounded-xl print:hidden">
              <a href={waLink} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 size-4" />Order on WhatsApp</a>
            </Button>
          )}
          {wa && <p className="mt-2 hidden text-sm font-semibold print:block">WhatsApp: +{wa}</p>}
          <p className="mt-3 break-all text-[11px] text-muted-foreground">{url.replace("https://", "")}</p>
        </div>
        <div className="mt-4 flex gap-2 print:hidden">
          <input value={table} onChange={(e) => setTable(e.target.value.trim())} placeholder="Table no. (optional)" aria-label="Table number"
            className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm" />
          <Button variant="outline" onClick={() => window.print()} className="rounded-xl"><Printer className="mr-1 size-4" />Print</Button>
        </div>
      </div>
    </AppShell>
  );
}
