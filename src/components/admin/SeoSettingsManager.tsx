import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Search,
  Globe,
  Share2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Smartphone,
  Monitor,
  Copy,
  Check,
  Code,
  FileCode,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getClientOrigin } from "@/lib/seo";

interface SeoSettingsManagerProps {
  form: any;
  setForm: (fn: (prev: any) => any) => void;
}

export function SeoSettingsManager({ form, setForm }: SeoSettingsManagerProps) {
  const [previewMode, setPreviewMode] = useState<"google" | "whatsapp">("google");
  const [googleDevice, setGoogleDevice] = useState<"mobile" | "desktop">("mobile");
  const [detectedOrigin, setDetectedOrigin] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDetectedOrigin(window.location.origin);
    }
  }, []);

  const activeDomain =
    form.custom_domain?.trim() ||
    detectedOrigin ||
    "https://fishnfresh.store";

  const cleanDomainDisplay = activeDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const handleDetectDomain = () => {
    if (detectedOrigin) {
      setForm((prev: any) => ({ ...prev, custom_domain: detectedOrigin }));
      toast.success(`Active domain set to: ${detectedOrigin}`);
    }
  };

  const copyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success(`Copied ${label} URL to clipboard!`);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const storeName = form.store_name || "Fish N Fresh";
  const seoTitle = form.seo_title_template
    ? form.seo_title_template.replace("{{store_name}}", storeName).replace("%s", "Fresh Seafood & Farm Meat")
    : `${storeName} — Fresh Seafood & Farm Meat Delivered`;

  const seoDesc =
    form.seo_default_description ||
    "Order dock-fresh seafood and chemical-free meat delivered in 35 minutes. Lab-tested quality, packed in chilled ice boxes with live driver GPS tracking.";

  const descLength = seoDesc.length;

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="size-5 text-primary" />
              World-Class Search Engine Optimization (SEO) &amp; Social Graph Studio
            </CardTitle>
            <CardDescription className="text-xs">
              Every client domain automatically gets dynamic canonical links, Schema.org rich snippets, XML sitemaps, and Google preview cards.
            </CardDescription>
          </div>
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs font-bold gap-1">
            <CheckCircle2 className="size-3.5" /> Dynamic Domain Aware
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Domain & Canonical Auto-Discovery Row */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Globe className="size-3.5" /> Client Store Custom Domain / Canonical Host
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                All canonical URLs, sitemaps, and social share cards dynamically adapt to this domain.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1.5 shrink-0"
              onClick={handleDetectDomain}
            >
              <RefreshCw className="size-3.5" />
              Auto-Detect Active Domain
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={form.custom_domain ?? ""}
              onChange={(e) => setForm((prev: any) => ({ ...prev, custom_domain: e.target.value }))}
              placeholder="e.g. https://freshfishchennai.in"
              className="rounded-xl font-mono text-xs bg-background"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-primary/10">
            <span>Canonical Base URL:</span>
            <span className="font-mono font-bold text-foreground">{activeDomain}</span>
          </div>
        </div>

        {/* SEO Meta Titles, Descriptions & Keywords */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">SEO Title Template</Label>
              <Input
                value={form.seo_title_template ?? "%s | {{store_name}}"}
                onChange={(e) => setForm((prev: any) => ({ ...prev, seo_title_template: e.target.value }))}
                placeholder="%s | {{store_name}}"
                className="mt-1 rounded-xl text-xs"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Use <code className="text-primary font-mono">%s</code> for page name and <code className="text-primary font-mono">{"{{store_name}}"}</code> for store title.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Default Meta Description</Label>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    descLength >= 120 && descLength <= 160
                      ? "text-emerald-600 dark:text-emerald-400"
                      : descLength > 160
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {descLength}/160 chars {descLength >= 120 && descLength <= 160 ? "✓ Optimal" : ""}
                </span>
              </div>
              <Textarea
                rows={3}
                value={form.seo_default_description ?? ""}
                onChange={(e) => setForm((prev: any) => ({ ...prev, seo_default_description: e.target.value }))}
                placeholder="Kasimedu Harbour Catch & Fresh Farm Meat delivered in 35 minutes..."
                className="mt-1 rounded-xl text-xs leading-relaxed"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Primary SEO Target Keywords</Label>
              <Input
                value={form.seo_keywords ?? ""}
                onChange={(e) => setForm((prev: any) => ({ ...prev, seo_keywords: e.target.value }))}
                placeholder="fresh fish online, seer fish, vanjaram, prawns, chennai seafood..."
                className="mt-1 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Default Social Share (OpenGraph) Banner URL</Label>
              <Input
                value={form.seo_og_image ?? ""}
                onChange={(e) => setForm((prev: any) => ({ ...prev, seo_og_image: e.target.value }))}
                placeholder="https://images.unsplash.com/... or upload image"
                className="mt-1 rounded-xl text-xs font-mono"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                High-resolution image (1200x630 px) displayed when store links are shared on WhatsApp, Facebook, or X.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Google Search Console Verification</Label>
                <Input
                  value={form.google_site_verification ?? ""}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, google_site_verification: e.target.value }))}
                  placeholder="e.g. 7qX8w... token"
                  className="mt-1 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Bing Webmaster Verification</Label>
                <Input
                  value={form.bing_site_verification ?? ""}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, bing_site_verification: e.target.value }))}
                  placeholder="e.g. 9F8A7... token"
                  className="mt-1 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Google Analytics 4 (GA4) ID</Label>
                <Input
                  value={form.ga4_measurement_id ?? ""}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, ga4_measurement_id: e.target.value }))}
                  placeholder="G-XXXXXXXXXX"
                  className="mt-1 rounded-xl text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Meta (Facebook) Pixel ID</Label>
                <Input
                  value={form.meta_pixel_id ?? ""}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, meta_pixel_id: e.target.value }))}
                  placeholder="e.g. 1234567890"
                  className="mt-1 rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Search & Social Graph Preview */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Live Search &amp; Social Simulator
              </span>
              <Badge variant="outline" className="text-[10px]">Real-Time Render</Badge>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant={previewMode === "google" ? "default" : "outline"}
                className="h-7 text-xs rounded-lg px-2.5"
                onClick={() => setPreviewMode("google")}
              >
                <Search className="size-3 mr-1" /> Google SERP
              </Button>
              <Button
                size="sm"
                variant={previewMode === "whatsapp" ? "default" : "outline"}
                className="h-7 text-xs rounded-lg px-2.5"
                onClick={() => setPreviewMode("whatsapp")}
              >
                <Share2 className="size-3 mr-1" /> Social Card
              </Button>
            </div>
          </div>

          {previewMode === "google" ? (
            <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  Google Search Result Preview
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setGoogleDevice("mobile")}
                    className={`p-1 rounded ${googleDevice === "mobile" ? "bg-muted text-primary" : "text-muted-foreground"}`}
                    title="Mobile SERP"
                  >
                    <Smartphone className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoogleDevice("desktop")}
                    className={`p-1 rounded ${googleDevice === "desktop" ? "bg-muted text-primary" : "text-muted-foreground"}`}
                    title="Desktop SERP"
                  >
                    <Monitor className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Realistic Google Snippet Card */}
              <div className={`p-4 rounded-xl border bg-white text-black font-sans ${googleDevice === "mobile" ? "max-w-md" : "max-w-xl"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-5 rounded-full bg-sky-100 flex items-center justify-center text-xs overflow-hidden border">
                    {form.logo_url ? <img src={form.logo_url} alt="" className="size-full object-cover" /> : "🐟"}
                  </div>
                  <div className="leading-none min-w-0">
                    <p className="text-xs font-medium text-neutral-800 truncate">{storeName}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{cleanDomainDisplay} › catalog › fresh-catch</p>
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-[#1a0dab] hover:underline cursor-pointer leading-snug">
                  {seoTitle}
                </h3>
                <p className="text-xs text-[#4d5156] mt-1 leading-relaxed line-clamp-2">
                  {seoDesc}
                </p>

                {/* Sitelinks search snippets */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-neutral-100 text-xs">
                  <div>
                    <span className="font-semibold text-[#1a0dab]">Daily Catch Catalog</span>
                    <p className="text-[10px] text-neutral-500">King Mackerel, Pomfret, Prawns &amp; Crabs</p>
                  </div>
                  <div>
                    <span className="font-semibold text-[#1a0dab]">Track Active Delivery</span>
                    <p className="text-[10px] text-neutral-500">Live order PIN &amp; temperature tracking</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
              <span className="text-[11px] font-semibold text-muted-foreground">
                WhatsApp &amp; Facebook Rich OpenGraph Card Preview
              </span>

              {/* Realistic WhatsApp Chat Bubble Preview */}
              <div className="max-w-sm rounded-2xl bg-[#DCF8C6] dark:bg-emerald-950/40 p-2.5 border border-emerald-500/20 text-foreground text-xs space-y-2">
                <div className="rounded-xl overflow-hidden bg-neutral-900 border">
                  {form.seo_og_image || form.logo_url ? (
                    <img
                      src={form.seo_og_image || form.logo_url}
                      alt={storeName}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-tr from-sky-600 to-primary flex items-center justify-center text-white font-bold">
                      {storeName}
                    </div>
                  )}
                  <div className="p-3 bg-muted/90 text-foreground">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{cleanDomainDisplay}</p>
                    <h4 className="font-bold text-xs mt-0.5 line-clamp-1">{seoTitle}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{seoDesc}</p>
                  </div>
                </div>
                <div className="text-[11px] text-emerald-900 dark:text-emerald-300 font-mono">
                  {activeDomain}/catalog
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Sitemaps & Technical SEO Endpoints */}
        <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <FileCode className="size-4 text-primary" />
              Dynamic Server Endpoints (Built for Automated Search Indexing)
            </span>
            <Badge variant="outline" className="text-[10px] font-semibold">
              Live &amp; Auto-Updating
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Dynamic Sitemap */}
            <div className="p-3 rounded-xl border bg-card flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-primary">/sitemap.xml</span>
                  <Badge className="bg-emerald-600 text-[9px] py-0 px-1">XML</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  Auto-indexes homepage, catalog, and all active products with image tags.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => copyLink(`${activeDomain}/sitemap.xml`, "Sitemap")}
                  title="Copy Sitemap URL"
                >
                  {copiedUrl?.includes("sitemap") ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0 text-primary"
                  asChild
                  title="Open Live Sitemap"
                >
                  <a href="/sitemap.xml" target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Dynamic Robots.txt */}
            <div className="p-3 rounded-xl border bg-card flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-primary">/robots.txt</span>
                  <Badge className="bg-sky-600 text-[9px] py-0 px-1">TXT</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  Authorizes Googlebot &amp; Bingbot while protecting private admin routes.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => copyLink(`${activeDomain}/robots.txt`, "Robots.txt")}
                  title="Copy Robots.txt URL"
                >
                  {copiedUrl?.includes("robots") ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0 text-primary"
                  asChild
                  title="Open Live Robots.txt"
                >
                  <a href="/robots.txt" target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
            <span>Structured Data Schemas included: <strong>WebSite</strong>, <strong>Store/FishStore</strong>, <strong>Product &amp; Offer</strong>, <strong>BreadcrumbList</strong>, <strong>FAQPage</strong></span>
            <a
              href="https://search.google.com/test/rich-results"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1 font-semibold"
            >
              Test on Google Rich Results Tool <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
