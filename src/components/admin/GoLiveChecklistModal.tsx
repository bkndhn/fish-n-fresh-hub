import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Store,
  CreditCard,
  Mail,
  Fish,
  MapPin,
  FileCheck,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { settingsQuery } from "@/lib/queries";
import { adminProductsQuery } from "@/lib/admin";
import { isPaymentsConfigured, getStripeEnvironment } from "@/lib/stripe";

export function GoLiveChecklistModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: settings } = useQuery(settingsQuery);
  const { data: products = [] } = useQuery(adminProductsQuery);

  const hasStoreName = Boolean(settings?.store_name && settings.store_name !== "Fish N Fresh");
  const hasStorePhone = Boolean(settings?.support_phone || settings?.contact_phone || settings?.whatsapp_number);
  const hasStoreAddress = Boolean(settings?.store_address);
  const hasGstin = Boolean((settings as any)?.gstin);
  const hasFssai = Boolean((settings as any)?.fssai_license_no || (settings as any)?.fssai_number);

  const paymentsConfigured = isPaymentsConfigured();
  const stripeEnv = getStripeEnvironment();

  const hasEmailSender = Boolean((settings as any)?.resend_api_key || (settings as any)?.sender_email);
  const hasProducts = products.length >= 5;
  const inStockProducts = products.filter((p) => Number(p.stock || 0) > 0).length;

  const checklist = [
    {
      id: "store_profile",
      title: "Store Profile & Address",
      desc: "Store name, coastal address, and WhatsApp contact phone",
      done: hasStoreName && hasStorePhone && hasStoreAddress,
      href: "/admin/settings",
      icon: Store,
    },
    {
      id: "legal_compliance",
      title: "GSTIN & FSSAI Compliance",
      desc: "GST identification number & 14-digit FSSAI seafood license number",
      done: hasGstin && hasFssai,
      href: "/admin/settings",
      icon: ShieldCheck,
    },
    {
      id: "payment_keys",
      title: "Payment Gateway (Stripe / Razorpay)",
      desc: paymentsConfigured
        ? `Configured in ${stripeEnv.toUpperCase()} mode`
        : "Add Publishable & Secret keys for card and digital payments",
      done: paymentsConfigured,
      warning: paymentsConfigured && stripeEnv === "sandbox" ? "Running in Sandbox (Test) mode" : undefined,
      href: "/admin/settings",
      icon: CreditCard,
    },
    {
      id: "email_notifications",
      title: "Transactional Email & Tax Invoices",
      desc: "Resend API key and sender address for order confirmation receipts",
      done: hasEmailSender,
      href: "/admin/settings",
      icon: Mail,
    },
    {
      id: "catalog",
      title: "Seafood Catalog & Stock",
      desc: `${products.length} products total (${inStockProducts} in stock)`,
      done: hasProducts && inStockProducts >= 3,
      href: "/admin/products",
      icon: Fish,
    },
    {
      id: "delivery_slots",
      title: "Delivery Zones & Operating Hours",
      desc: "Base delivery fee, per-km charge, and store operating hours",
      done: true, // Defaults always provisioned
      href: "/admin/schedule",
      icon: MapPin,
    },
    {
      id: "commercial_license",
      title: "Commercial License Agreement",
      desc: "Client software terms of service & SLA document",
      done: true,
      href: "/licence",
      icon: FileCheck,
    },
  ];

  const completedCount = checklist.filter((i) => i.done).length;
  const progressPct = Math.round((completedCount / checklist.length) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Rocket className="size-5 text-primary" /> Store Go-Live Readiness
            </DialogTitle>
            <Badge
              variant={progressPct === 100 ? "default" : "outline"}
              className="rounded-full text-xs px-2.5 py-0.5"
            >
              {completedCount} / {checklist.length} Complete ({progressPct}%)
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Complete this checklist before launching your Fish N Fresh store to live retail customers.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="my-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressPct === 100 ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Items List */}
        <div className="space-y-2.5 py-2">
          {checklist.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3.5 flex items-start justify-between gap-3 transition ${
                  item.done
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border/70 bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                      item.done
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      {item.title}
                      {item.done ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="size-3.5 text-amber-500" />
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                    {item.warning && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                        ⚠️ {item.warning}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-7 text-[11px] shrink-0 font-semibold gap-1"
                  asChild
                  onClick={() => onOpenChange(false)}
                >
                  <Link to={item.href}>
                    Configure <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {progressPct === 100
              ? "🎉 Store is 100% configured for production launch!"
              : "Complete the pending items above to accept real customer orders."}
          </p>

          <Button
            size="sm"
            className="rounded-xl w-full sm:w-auto text-xs"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
