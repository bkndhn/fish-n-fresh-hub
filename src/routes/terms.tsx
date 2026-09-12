import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentTenant } from "@/lib/tenant";
import { ShieldCheck, Snowflake, Scale, KeyRound, RotateCcw, ReceiptText, PhoneCall, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from '@/lib/types';

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms and Conditions & Statutory Policies" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { data: settings } = useQuery(settingsQuery);
  const tenant = getCurrentTenant();
  const storeName = settings?.store_name || "Fish N Fresh Hub";
  const legalName = (settings as SiteSettings)?.gst_legal_name || (settings as SiteSettings)?.firm_name || storeName;
  const gstin = (settings as SiteSettings)?.gstin || "Available on Tax Invoice";
  const fssai = (settings as SiteSettings)?.fssai_license_no || (settings as SiteSettings)?.fssai_number || "FSSAI Certified";
  const supportPhone = settings?.support_phone || settings?.whatsapp_number || "+91 98430 61919";
  const supportEmail = (settings as SiteSettings)?.support_email || (settings as SiteSettings)?.sender_email || "support@fishnfresh.in";
  const address = settings?.store_address || "Coastal Retail Store Hub, Tamil Nadu, India";

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6">
        {/* Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="rounded-xl -ml-2 text-muted-foreground hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="mr-1.5 size-4" /> Back to Store
            </Link>
          </Button>
          <Badge variant="outline" className="text-[11px] font-mono border-primary/30 text-primary">
            Statutory Version 2.2 · Updated September 2026
          </Badge>
        </div>

        {/* Title Header */}
        <div className="border-b border-border pb-6 mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Terms of Service &amp; Statutory Policies
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Operating standards, cold-chain assurance, perishable return policies, and consumer protection terms.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
            <div>
              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block">Operating Entity</span>
              <p className="font-bold text-foreground">{legalName}</p>
              <p className="text-muted-foreground text-[11px]">{storeName} ({tenant.tenantId})</p>
            </div>
            <div>
              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block">Food Safety &amp; GSTIN</span>
              <p className="font-mono text-foreground font-semibold">FSSAI: {fssai}</p>
              <p className="font-mono text-muted-foreground text-[11px]">GSTIN: {gstin}</p>
            </div>
            <div>
              <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block">Grievance &amp; Support</span>
              <p className="font-semibold text-foreground">{supportPhone}</p>
              <p className="text-muted-foreground text-[11px] truncate">{supportEmail}</p>
            </div>
          </div>
        </div>

        {/* Custom Terms Override if entered by admin */}
        {settings?.terms_and_conditions ? (
          <div className="mb-8 rounded-2xl border border-border bg-card p-6 prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-base font-bold text-foreground mb-3">Merchant Custom Terms</h2>
            <p className="whitespace-pre-wrap">{settings.terms_and_conditions}</p>
          </div>
        ) : null}

        {/* Standard Statutory Sections */}
        <div className="space-y-8 text-xs sm:text-sm leading-relaxed text-muted-foreground">
          {/* Section 1 */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <ShieldCheck className="size-5 text-primary shrink-0" />
              <h2>1. FSSAI Compliance &amp; Safe Seafood Handling</h2>
            </div>
            <p>
              All fish, prawns, crabs, poultry, and meat retailed under <strong className="text-foreground">{storeName}</strong> adhere strictly to the food safety norms mandated by the Food Safety and Standards Authority of India (FSSAI) under License No. <span className="font-mono font-semibold text-foreground">{fssai}</span>.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>100% Chemical-Free: Zero formaldehyde, zero ammonia, and zero chemical preservatives are added to preserve fish.</li>
              <li>Sourced daily from verified coastal artisanal boats and bio-secure poultry farms.</li>
              <li>Staff members undergo mandatory hygiene, sanitized hairnet, and glove protocols during cutting and packing.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <Snowflake className="size-5 text-sky-500 shrink-0" />
              <h2>2. Cold-Chain Integrity &amp; Temperature Guarantee</h2>
            </div>
            <p>
              Perishable seafood and meat demand uninterrupted cold chains to prevent bacterial growth and maintain taste:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Transit Temperature: Kept consistently between <strong>0°C to 4°C</strong> using sanitized food-grade insulated chill-boxes with food-grade gel ice packs.</li>
              <li>Express Dispatch: Delivery slots are carefully optimized to minimize transit duration from hub to doorstep.</li>
              <li>Customer Storage Recommendation: Upon receipt, the product must be cooked within 24 hours or transferred immediately to a domestic freezer at -18°C.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <Scale className="size-5 text-amber-500 shrink-0" />
              <h2>3. Weight, Gross vs. Net Yield &amp; Cutting Tolerance</h2>
            </div>
            <p>
              Fresh whole seafood undergoes descaling, gutting, degilling, and cleaning before packaging:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Gross Weight vs. Net Weight:</strong> Unless explicitly designated as &quot;Gross Weight&quot;, all items indicate their estimated whole weight before cleaning. Cleaning yields naturally result in a 15% to 30% yield variation depending on the fish anatomy (head, viscera, scales).</li>
              <li>Tolerance: Due to natural variations in individual whole catches, individual packet weights may vary by &plusmn;5%. Any weight difference is fairly compensated through loyalty wallet credits or pro-rata invoicing.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <KeyRound className="size-5 text-emerald-500 shrink-0" />
              <h2>4. Doorstep Delivery &amp; One-Time Delivery PIN (OTP) Verification</h2>
            </div>
            <p>
              To eliminate misdeliveries and guarantee that temperature-sensitive packages reach the rightful recipient:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Every dispatched order generates a secure <strong>4-digit One-Time Delivery PIN</strong> visible on the customer&apos;s order screen.</li>
              <li>The delivery executive cannot mark an order as complete without verifying this PIN directly with the customer.</li>
              <li>If the recipient is unavailable at the designated address during the chosen delivery slot, our dispatch team will hold the package on ice for a maximum of 30 minutes before returning to hub. Re-delivery may incur standard delivery charges.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <RotateCcw className="size-5 text-rose-500 shrink-0" />
              <h2>5. Perishable Return &amp; Refund SLA (Consumer Protection E-Commerce Rules, 2020)</h2>
            </div>
            <p>
              In compliance with the Consumer Protection (E-Commerce) Rules, 2020:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li><strong>Inspection at Doorstep:</strong> Customers are requested to inspect the seal and freshness indicator upon handover.</li>
              <li><strong>2-Hour Quality Guarantee Window:</strong> Given the perishable nature of fresh seafood, any discrepancy in freshness, smell, cut type, or damage must be reported within <strong>2 hours</strong> of delivery through customer chat or WhatsApp.</li>
              <li><strong>Resolution SLA:</strong> Validated quality complaints will be addressed with an immediate replacement dispatch or a 100% refund credited to the customer&apos;s in-app wallet or original payment source within 24–48 banking hours.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <ReceiptText className="size-5 text-indigo-500 shrink-0" />
              <h2>6. GST Tax Invoicing &amp; Digital Billing</h2>
            </div>
            <p>
              Every transaction is processed with a statutory Tax Invoice under Rule 46 of the CGST Rules, 2017:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs">
              <li>Unprocessed fresh and chilled seafood is classified under HSN Code 0302 (exempt from CGST/SGST under Notification No. 2/2017-Central Tax).</li>
              <li>Processed or marinated cuts, value-added products, and express delivery logistics include standard statutory GST rates (CGST + SGST).</li>
              <li>A digital copy of the GSTIN Tax Invoice is instantly dispatched via email upon checkout confirmation and remains downloadable from the order history page.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-base">
              <PhoneCall className="size-5 text-primary shrink-0" />
              <h2>7. Grievance Officer &amp; Statutory Redressal</h2>
            </div>
            <p>
              In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, the designated Grievance Officer for consumer complaints is:
            </p>
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs space-y-1">
              <p><strong>Grievance Officer:</strong> Customer Experience Lead</p>
              <p><strong>Company:</strong> {legalName}</p>
              <p><strong>Address:</strong> {address}</p>
              <p><strong>Email:</strong> <span className="font-mono text-primary">{supportEmail}</span></p>
              <p><strong>Phone:</strong> {supportPhone}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Complaints are acknowledged within 48 hours and resolved within 1 month from the date of receipt.</p>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
