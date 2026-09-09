import { useState } from "react";
import { toast } from "sonner";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Send,
  MessageCircle,
  Flame,
  Zap,
  Tag,
  Globe,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export interface SocialTemplate {
  id: string;
  category: string;
  name: string;
  headline: string;
  badge: string;
  couponCode?: string;
  body: string;
  hashtags: string[];
}

const CAMPAIGN_TEMPLATES: SocialTemplate[] = [
  {
    id: "morning_dock_rush",
    category: "Fresh Catch",
    name: "🌅 Morning Harbour Fresh Catch Alert",
    headline: "Kasimedu Dock Fresh Catch Has Just Landed!",
    badge: "Just Landed",
    couponCode: "DOCKFRESH",
    body: "Morning fish lovers! Fresh catch from deep sea trawlers has just docked at our counter. Premium King Mackerel (Vanjaram), Diamond Silver Pomfret, and Jumbo Tiger Prawns are on ice right now. Meticulously cleaned, sliced to perfection, and delivered fresh to your doorstep in 45 mins!",
    hashtags: ["#FreshFish", "#KasimeduCatch", "#Vanjaram", "#TigerPrawns", "#FishNFresh", "#ChennaiSeafood", "#NoChemicals"],
  },
  {
    id: "weekend_feast",
    category: "Weekend Offer",
    name: "⚡ Weekend Seafood Feast — Flat 15% Off",
    headline: "Level Up Your Sunday Lunch with Pure Fresh Seafood!",
    badge: "Weekend Special",
    couponCode: "WEEKEND15",
    body: "Planning an unforgettable Sunday family lunch? Grab tender Red Snapper, succulent Mud Crabs, and Seer fish steaks. Flat 15% OFF on orders above ₹699. Free gourmet gutting, descaling, and custom cuts included!",
    hashtags: ["#SundayFeast", "#SeafoodSundays", "#FishCurryMeen", "#FishFry", "#FishNFreshDiscounts", "#WeekendSpecial"],
  },
  {
    id: "live_crabs_exotic",
    category: "Exotic & Shellfish",
    name: "🦀 Live Coastal Mud Crabs & Jumbo Prawns",
    headline: "Limited Stock: Heavy Blue Sea Crabs & Deveined Prawns!",
    badge: "Limited Stock",
    couponCode: "SHELL10",
    body: "Heavy shell, succulent sweet meat. Our coastal sea crabs and jumbo tiger prawns are in high demand today. Perfect for aromatic Chettinad crab roast or garlic butter butterflied prawns. Order now before batches sell out!",
    hashtags: ["#LiveCrabs", "#MudCrabRoast", "#JumboPrawns", "#ExoticSeafood", "#CoastalFlavours", "#SeafoodGram"],
  },
  {
    id: "evening_rush",
    category: "Flash Sale",
    name: "🔥 Evening Flash Delivery: Flat ₹100 Off",
    headline: "Dinner Seafood Cravings? We Deliver Fresh in 40 Mins!",
    badge: "Flash Deal",
    couponCode: "DINNER100",
    body: "Skip the market hassle. Get ready-to-fry seasoned Seer steaks and fresh curry cuts delivered right to your pan. Flat ₹100 OFF on your dinner cart with code DINNER100. Ultra-hygienic ice-boxed packaging!",
    hashtags: ["#DinnerPrep", "#QuickDinner", "#MeenKulambu", "#HealthyProtein", "#FreshCatchToday"],
  },
];

export function SocialCampaignHub() {
  const [selectedTemplate, setSelectedTemplate] = useState<SocialTemplate>(CAMPAIGN_TEMPLATES[0]!);
  const [customHeadline, setCustomHeadline] = useState(selectedTemplate.headline);
  const [customBody, setCustomBody] = useState(selectedTemplate.body);
  const [couponCode, setCouponCode] = useState(selectedTemplate.couponCode || "");
  const [storeUrl, setStoreUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : "https://fishnfresh.store"
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleSelectTemplate = (tpl: SocialTemplate) => {
    setSelectedTemplate(tpl);
    setCustomHeadline(tpl.headline);
    setCustomBody(tpl.body);
    setCouponCode(tpl.couponCode || "");
  };

  const getUtmUrl = (platform: string) => {
    const base = storeUrl.replace(/\/$/, "");
    return `${base}/?utm_source=${platform}&utm_medium=social&utm_campaign=${selectedTemplate.id}${
      couponCode ? `&promo=${encodeURIComponent(couponCode)}` : ""
    }`;
  };

  const generatePostCopy = (platform: "whatsapp" | "instagram" | "twitter" | "telegram") => {
    const targetUrl = getUtmUrl(platform);
    const tagString = selectedTemplate.hashtags.join(" ");

    switch (platform) {
      case "whatsapp":
        return `🐟 *${customHeadline.toUpperCase()}*\n\n${customBody}\n\n${
          couponCode ? `🎟️ Use Coupon Code: *${couponCode}* at checkout\n\n` : ""
        }🛒 *Order Online Now:* ${targetUrl}\n\n⚡ _100% Chemical-Free | Meticulously Cleaned | Express Ice Box Delivery_`;

      case "instagram":
        return `🌊 ${customHeadline}\n\n${customBody}\n\n${
          couponCode ? `🎁 Use Code: "${couponCode}" for instant discount at checkout!\n\n` : ""
        }📲 Link in bio to order fresh harbour catch in 45 mins: ${targetUrl}\n\n.\n.\n${tagString}`;

      case "twitter":
        const brief = customHeadline.length > 120 ? customHeadline.slice(0, 117) + "..." : customHeadline;
        return `🐟 ${brief}\n\n${customBody.slice(0, 100)}...\n\n${
          couponCode ? `🎟️ Code: ${couponCode}\n` : ""
        }🛒 Order: ${targetUrl}\n\n#FreshFish #KasimeduCatch`;

      case "telegram":
        return `🌊 *${customHeadline}*\n\n${customBody}\n\n${
          couponCode ? `🏷️ *Promo Code:* \`${couponCode}\`\n\n` : ""
        }🚀 *Order Fresh Seafood Now:* ${targetUrl}\n\n${tagString}`;
    }
  };

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label} campaign text to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const dispatchWhatsApp = () => {
    const text = generatePostCopy("whatsapp");
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  const dispatchTwitter = () => {
    const text = generatePostCopy("twitter");
    const encoded = encodeURIComponent(text);
    window.open(`https://twitter.com/intent/tweet?text=${encoded}`, "_blank");
  };

  const dispatchTelegram = () => {
    const text = generatePostCopy("telegram");
    const url = getUtmUrl("telegram");
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-primary/5 to-cyan-500/10 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500 text-white shadow-sm">
                <Share2 className="size-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight text-foreground">
                Automated Omnichannel Social Campaign Hub
              </h2>
              <Badge className="bg-sky-600 hover:bg-sky-600 text-[11px] font-bold">1-Click Dispatch</Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Generate conversion-optimized, professional marketing copy for WhatsApp broadcast groups, Instagram/Facebook captions, Twitter/X tweets, and Telegram channels with automatic UTM tracking links.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-sky-500/30 text-sky-600 dark:text-sky-400 gap-1.5 h-9"
              onClick={() => {
                handleSelectTemplate(CAMPAIGN_TEMPLATES[0]!);
                toast.success("Reset to morning dock catch template");
              }}
            >
              <RefreshCw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Preset Campaign Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            1. Select Campaign Template
          </Label>
          <span className="text-[11px] text-muted-foreground">Click a preset to load proven copy</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CAMPAIGN_TEMPLATES.map((tpl) => {
            const isSelected = selectedTemplate.id === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/30 shadow-sm"
                    : "border-border/80 bg-card hover:border-sky-500/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      {tpl.category}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-sky-500/30 font-semibold">
                      {tpl.badge}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-xs text-foreground line-clamp-1">{tpl.name}</h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{tpl.headline}</p>
                </div>

                {tpl.couponCode && (
                  <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Coupon:</span>
                    <span className="font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {tpl.couponCode}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor & Customizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Customization Form */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                2. Customize Message & Deal
              </CardTitle>
              <CardDescription className="text-xs">
                Fine-tune your headline, coupon code, and marketing text before broadcasting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div>
                <Label className="text-xs font-semibold">Campaign Catch Headline</Label>
                <Input
                  value={customHeadline}
                  onChange={(e) => setCustomHeadline(e.target.value)}
                  className="mt-1 rounded-xl text-xs font-semibold"
                  placeholder="Catchy headline..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Discount Code (Optional)</Label>
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="mt-1 rounded-xl uppercase font-mono text-xs font-bold"
                    placeholder="e.g. DOCKFRESH"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Online Store Base URL</Label>
                  <Input
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    className="mt-1 rounded-xl text-xs font-mono"
                    placeholder="https://yourshop.com"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Promotional Body Copy</Label>
                <Textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  rows={4}
                  className="mt-1 rounded-xl text-xs leading-relaxed"
                  placeholder="Detailed offer and description..."
                />
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Auto-Attaching UTM Source Tracking:</span>
                <span className="font-mono font-semibold text-primary">?utm_source=...&utm_campaign={selectedTemplate.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Multi-Platform 1-Click Launchers */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="size-4 text-sky-500" />
                3. Dispatch & Copy by Platform
              </CardTitle>
              <CardDescription className="text-xs">
                Broadcast instantly to customers or copy ready-to-paste posts with formatted hashtags.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* WhatsApp Row */}
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
                    <MessageCircle className="size-4" />
                  </span>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">WhatsApp Broadcast & Status</h5>
                    <p className="text-[11px] text-muted-foreground">Bold text formatting, direct deep link, and coupon</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-xs gap-1 border-emerald-500/40 hover:bg-emerald-500/10"
                    onClick={() => copyToClipboard(generatePostCopy("whatsapp"), "wa", "WhatsApp")}
                  >
                    {copiedKey === "wa" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copiedKey === "wa" ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={dispatchWhatsApp}
                  >
                    <ExternalLink className="size-3" />
                    Open WhatsApp
                  </Button>
                </div>
              </div>

              {/* Instagram & Facebook Row */}
              <div className="p-3.5 rounded-2xl border border-pink-500/30 bg-pink-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-sm">
                    <Globe className="size-4" />
                  </span>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">Instagram & Facebook Post / Reels</h5>
                    <p className="text-[11px] text-muted-foreground">Curated hashtags, emojis, and link in bio callout</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-xs gap-1 border-pink-500/40 hover:bg-pink-500/10"
                    onClick={() => copyToClipboard(generatePostCopy("instagram"), "ig", "Instagram")}
                  >
                    {copiedKey === "ig" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copiedKey === "ig" ? "Copied Caption" : "Copy Caption"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-xs gap-1"
                    onClick={() => window.open("https://business.facebook.com/creatorstudio", "_blank")}
                  >
                    <ExternalLink className="size-3" />
                    Meta Studio
                  </Button>
                </div>
              </div>

              {/* Twitter / X Row */}
              <div className="p-3.5 rounded-2xl border border-neutral-700/30 bg-neutral-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm font-bold text-xs">
                    𝕏
                  </span>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">Twitter / X Post Intent</h5>
                    <p className="text-[11px] text-muted-foreground">Character-counted concise catch tweet</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-xs gap-1"
                    onClick={() => copyToClipboard(generatePostCopy("twitter"), "tw", "Twitter/X")}
                  >
                    {copiedKey === "tw" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copiedKey === "tw" ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    onClick={dispatchTwitter}
                  >
                    <ExternalLink className="size-3" />
                    Post on 𝕏
                  </Button>
                </div>
              </div>

              {/* Telegram Row */}
              <div className="p-3.5 rounded-2xl border border-sky-500/30 bg-sky-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-sky-500 text-white shadow-sm">
                    <Send className="size-4" />
                  </span>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">Telegram Channel & VIP Customer Group</h5>
                    <p className="text-[11px] text-muted-foreground">Markdown code block promo tags and preview links</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-xs gap-1 border-sky-500/40 hover:bg-sky-500/10"
                    onClick={() => copyToClipboard(generatePostCopy("telegram"), "tg", "Telegram")}
                  >
                    {copiedKey === "tg" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copiedKey === "tg" ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1 bg-sky-500 hover:bg-sky-600 text-white"
                    onClick={dispatchTelegram}
                  >
                    <ExternalLink className="size-3" />
                    Share Telegram
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Live Preview Card */}
      <Card className="rounded-3xl border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Live Omnichannel Message Preview
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-semibold">
              Rendered with Live UTM & Promo Code
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 font-mono text-xs whitespace-pre-wrap bg-muted/10 text-foreground leading-relaxed">
          {generatePostCopy("whatsapp")}
        </CardContent>
      </Card>
    </div>
  );
}
