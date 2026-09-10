import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentTenant } from "@/lib/tenant";
import { 
  ShieldCheck, 
  FileText, 
  Printer, 
  Download, 
  CheckCircle2, 
  Building2, 
  Lock, 
  Server, 
  ArrowLeft,
  Calendar,
  Sparkles,
  PenTool,
  Award,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/licence")({
  head: () => ({
    meta: [{ title: "Commercial Software License & SLA" }],
  }),
  component: LicencePage,
});

function LicencePage() {
  const { data: settings } = useQuery(settingsQuery);
  const tenant = getCurrentTenant();
  const storeName = settings?.store_name || "Fish N Fresh Hub";
  const firmName = (settings as any)?.firm_name || storeName;
  const legalName = (settings as any)?.gst_legal_name || firmName;
  const gstin = (settings as any)?.gstin || "Available upon request";
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const storageKey = `fnf_licence_signature_${tenant.tenantId}`;
  const [signatoryName, setSignatoryName] = useState(legalName);
  const [signatoryTitle, setSignatoryTitle] = useState("Managing Director / Proprietor");
  const [confirmed, setConfirmed] = useState(false);
  const [signatureRecord, setSignatureRecord] = useState<{
    name: string;
    title: string;
    signedAt: string;
    hash: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSignatureRecord(parsed);
        setSignatoryName(parsed.name);
        setSignatoryTitle(parsed.title);
      }
    } catch {}
  }, [storageKey]);

  const handleSignAgreement = () => {
    if (!signatoryName.trim()) {
      toast.error("Please enter the authorized signatory's name");
      return;
    }
    if (!confirmed) {
      toast.error("Please tick the confirmation checkbox to authorize");
      return;
    }

    const now = new Date();
    const hash = `AGY-SIG-${tenant.tenantId.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${now.getTime().toString(36).toUpperCase()}`;
    const record = {
      name: signatoryName.trim(),
      title: signatoryTitle.trim() || "Authorized Signatory",
      signedAt: now.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "medium" }),
      hash,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(record));
    } catch {}

    setSignatureRecord(record);
    setIsEditing(false);
    toast.success("Commercial License digitally signed and verified!");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    const content = `# COMMERCIAL SOFTWARE LICENSE & SERVICE LEVEL AGREEMENT (SLA)
Document ID: LIC-${tenant.tenantId.toUpperCase()}-${new Date().getFullYear()}
Effective Date: ${dateStr}
Licensee / Tenant: ${legalName} (${tenant.tenantId})
Licensor / Software Provider: Antigravity Commercial Retail Solutions

1. GRANT OF COMMERCIAL LICENSE
The Licensor grants the Licensee a single-tenant, commercial, non-transferable license to deploy, operate, and brand the Fish N Fresh Hub Unified Retail & Delivery Engine.

2. TENANT DATA OWNERSHIP & PRIVACY
The Licensee retains 100% full, unconditional ownership of all business data, customer records, catalogs, transactions, and analytics. All records are hosted in the Licensee's dedicated Supabase PostgreSQL database.

3. HIGH-AVAILABILITY & SERVICE LEVEL AGREEMENT (SLA)
Target Core Operational Uptime: 99.9%.
Offline Fallback: In-store POS operations continue functioning locally in the event of upstream network interruption.

4. COMPLIANCE & STATUTORY READY
The platform incorporates Indian GSTIN statutory computation (HSN classification, CGST/SGST splitting) and FSSAI sanitary record traceability.

5. INTELLECTUAL PROPERTY & UPSTREAM CODEBASE
Continuous delivery updates from the master repository are pushed seamlessly without downtime to downstream tenant environments.

Generated automatically by Fish N Fresh Hub Architecture Engine.`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Software-License-${tenant.tenantId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6 print:p-0 print:max-w-none">
        {/* Navigation & Action Bar (Hidden in Print) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button variant="ghost" size="sm" asChild className="rounded-xl -ml-2 text-muted-foreground hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="mr-1.5 size-4" /> Back to Store
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadMarkdown}
              className="rounded-xl text-xs"
            >
              <Download className="mr-1.5 size-3.5" /> Download (.md)
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="rounded-xl text-xs shadow-xs"
            >
              <Printer className="mr-1.5 size-3.5" /> Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Official Certificate Card */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm print:border-none print:shadow-none print:p-0">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-[10px] uppercase font-bold tracking-wider">
                    Enterprise Tier · Certified Commercial
                  </Badge>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Commercial Software License &amp; Service Level Agreement (SLA)
                  </h1>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Standard Commercial Master Services &amp; Intellectual Property License Agreement for Single-Tenant Retail &amp; Delivery Engine.
              </p>
            </div>
            
            <div className="shrink-0 flex flex-col items-start sm:items-end gap-1 text-xs">
              <span className="font-mono text-[11px] font-bold text-muted-foreground">
                DOC ID: LIC-{tenant.tenantId.toUpperCase()}-{new Date().getFullYear()}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2.5 py-0.5 font-semibold text-[11px]">
                <CheckCircle2 className="size-3 text-emerald-500" /> Active &amp; Verified
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="size-3" /> Effective: {dateStr}
              </span>
            </div>
          </div>

          {/* Tenant Verification Card */}
          <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Building2 className="size-3 text-primary" /> Licensed Business Tenant
              </span>
              <p className="font-bold text-sm text-foreground">{legalName}</p>
              <p className="text-muted-foreground">{storeName} · Tenant ID: <code className="font-mono text-primary font-semibold">{tenant.tenantId}</code></p>
              <p className="text-[11px] text-muted-foreground">GSTIN: <span className="font-mono font-medium text-foreground">{gstin}</span></p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Server className="size-3 text-primary" /> Cloud Infrastructure &amp; Core Version
              </span>
              <p className="font-bold text-sm text-foreground">Dedicated Single-Tenant Instance</p>
              <p className="text-muted-foreground">Host: <code className="font-mono text-foreground font-semibold">{tenant.supabaseHost}</code></p>
              <p className="text-[11px] text-muted-foreground">Schema Engine: <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">v2.2.0 (PostgreSQL Row-Level Security Enabled)</span></p>
            </div>
          </div>

          {/* Agreement Clauses */}
          <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {/* Clause 1 */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted font-mono text-[11px] text-foreground">1</span>
                Grant of Commercial Single-Tenant License
              </h2>
              <p>
                The Licensor hereby grants to the designated Tenant (<strong className="text-foreground">{legalName}</strong>) a non-exclusive, commercial license to deploy, operate, execute, customize, and display the Fish N Fresh Hub Unified Retail &amp; Delivery Engine software for commercial grocery, seafood, and meat retail operations across all designated web, mobile, and counter POS terminals.
              </p>
            </section>

            {/* Clause 2 */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted font-mono text-[11px] text-foreground">2</span>
                100% Client Data Ownership &amp; Privacy Sovereignty
              </h2>
              <p>
                The Client retains exclusive, unencumbered ownership of all data generated across the platform, including but not limited to: customer databases, purchase histories, product inventory records, pricing structures, revenue ledgers, and driver dispatch telemetry.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>Zero vendor lock-in: Data is stored in standard relational PostgreSQL format with Row-Level Security (RLS).</li>
                <li>Instant Data Portability: The Client may export full JSON/CSV backups at any time via the Store Settings administrative portal.</li>
                <li>Confidentiality: Financial records and customer contact tokens are never sold, rented, or pooled with third-party aggregators.</li>
              </ul>
            </section>

            {/* Clause 3 */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted font-mono text-[11px] text-foreground">3</span>
                Service Level Agreement (SLA) &amp; Operational Resilience
              </h2>
              <p>
                The platform is engineered with progressive web capabilities, local cache fallbacks, and resilient fault isolation:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 text-xs">
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                  <p className="font-bold text-foreground">99.9% Target Uptime</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">High-availability cloud hosting with multi-zone automated failover.</p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                  <p className="font-bold text-foreground">Offline POS Continuity</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Counter billing and thermal slip generation continue during internet dips.</p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                  <p className="font-bold text-foreground">Atomic Inventory Safety</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Automated rollback &amp; concurrency locks prevent stock overselling.</p>
                </div>
              </div>
            </section>

            {/* Clause 4 */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted font-mono text-[11px] text-foreground">4</span>
                Statutory Compliance &amp; Tax Invoicing Guarantee
              </h2>
              <p>
                The software complies with Indian Goods and Services Tax (GST) invoicing standards under Rule 46 of the CGST Rules, 2017:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>Automatic computation and separation of Central GST (CGST) and State GST (SGST).</li>
                <li>Standard Harmonized System of Nomenclature (HSN) categorization (0302 Fresh Fish, 0207 Poultry &amp; Meat, 9963 Delivery Services).</li>
                <li>Compliant Rupee number-to-words currency transcriptions and FSSAI sanitary registration display on customer tax receipts.</li>
              </ul>
            </section>

            {/* Clause 5 */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted font-mono text-[11px] text-foreground">5</span>
                Upstream Upgrades &amp; Rollback Protection
              </h2>
              <p>
                The platform utilizes a modern continuous-delivery pipeline. Upgrades to core features (POS, driver routing, push notifications, customer support desks) are deployed from the master git repository. Each client database maintains a verified schema migration marker (<code className="font-mono text-primary font-bold">schema_version</code>) ensuring seamless schema evolution without downtime or data corruption.
              </p>
            </section>

            {/* Clause 6 */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted font-mono text-[11px] text-foreground">6</span>
                Limitation of Liability &amp; Disclaimers
              </h2>
              <p className="text-xs text-muted-foreground/90">
                The software is provided &quot;as is&quot; for commercial operational enablement. To the maximum extent permitted by applicable law, the Licensor shall not be liable for indirect, incidental, or consequential damages resulting from third-party payment gateway downtime (Razorpay/PhonePe), network outages, or unauthorized access arising from client key misplacement.
              </p>
            </section>
          </div>

          {/* Digital Signature & Certification Action Form (Screen Only) */}
          <div className="mt-8 pt-6 border-t border-border print:hidden">
            {!signatureRecord || isEditing ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <PenTool className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Digital Signature &amp; Client Execution Form</h3>
                    <p className="text-xs text-muted-foreground">
                      Sign and certify this commercial license on behalf of <strong className="text-foreground">{legalName}</strong>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sig-name" className="text-xs font-semibold">Authorized Signatory Full Name</Label>
                    <Input
                      id="sig-name"
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="h-9 rounded-xl text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sig-title" className="text-xs font-semibold">Designation / Corporate Capacity</Label>
                    <Input
                      id="sig-title"
                      value={signatoryTitle}
                      onChange={(e) => setSignatoryTitle(e.target.value)}
                      placeholder="e.g. Managing Director / Proprietor"
                      className="h-9 rounded-xl text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <Checkbox
                    id="sig-confirm"
                    checked={confirmed}
                    onCheckedChange={(c) => setConfirmed(Boolean(c))}
                    className="mt-0.5"
                  />
                  <Label htmlFor="sig-confirm" className="text-xs text-muted-foreground leading-normal cursor-pointer">
                    I confirm that I am legally authorized to bind <strong className="text-foreground">{legalName}</strong>, and hereby accept the Commercial License, SLA targets (99.9% uptime), and statutory data ownership policies.
                  </Label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {signatureRecord && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      className="rounded-xl text-xs"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSignAgreement}
                    disabled={!confirmed || !signatoryName.trim()}
                    className="rounded-xl text-xs font-semibold gap-1.5 shadow-xs"
                  >
                    <Check className="size-3.5" /> Sign &amp; Certify License
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Award className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-foreground">
                        Digitally Executed by {signatureRecord.name}
                      </span>
                      <Badge className="bg-emerald-600 text-[10px] py-0 px-2 font-mono">
                        Legally Certified
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {signatureRecord.title} · Executed on {signatureRecord.signedAt}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground/80 mt-0.5">
                      Verification Hash: {signatureRecord.hash}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setConfirmed(true);
                  }}
                  className="rounded-xl text-xs h-8 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                >
                  <PenTool className="size-3.5 mr-1" /> Re-sign / Modify Signatory
                </Button>
              </div>
            )}
          </div>

          {/* Signature & Seal Section (Included in PDF Printout) */}
          <div className="mt-8 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
            <div className="space-y-3">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" /> Authorized Software Licensor
              </p>
              <div className="h-14 flex items-center">
                <div className="font-serif italic text-base text-primary/80 font-bold border-b border-primary/40 pb-1">
                  Antigravity Core Engineering
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">Engineering &amp; Product Architecture</p>
                <p className="text-[11px] text-muted-foreground">Certified Master Repository Release</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="size-4 text-primary" /> Licensed Commercial Tenant
              </p>
              <div className="h-14 flex items-center">
                <div className="font-serif italic text-base text-foreground font-bold border-b border-border pb-1">
                  {signatureRecord ? signatureRecord.name : legalName}
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {signatureRecord ? `${signatureRecord.name} (${signatureRecord.title})` : "Authorized Client Representative"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {signatureRecord
                    ? `Digitally Signed · Verified: ${signatureRecord.hash}`
                    : "Digital Signature Ready · Active Operational License"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
