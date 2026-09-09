import { useState, useEffect } from "react";
import { Sparkles, HeartPulse, Flame, Dumbbell, ChefHat, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Product, ProductAiBenefits } from "@/lib/types";
import { getOrGenerateProductAiBenefits } from "@/lib/aiBenefits";
import { useTranslation } from "@/lib/i18n";

export function ProductAiBenefitsCard({ product }: { product: Product }) {
  const { lang } = useTranslation();
  const [activeLang, setActiveLang] = useState<"en" | "ta" | "hi">(
    lang === "ta" ? "ta" : lang === "hi" ? "hi" : "en"
  );
  const [profile, setProfile] = useState<ProductAiBenefits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getOrGenerateProductAiBenefits(product).then((data) => {
      if (isMounted) {
        setProfile(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [product.id, product.name]);

  if (loading && !profile) {
    return (
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 animate-pulse space-y-3">
        <div className="h-5 w-48 bg-primary/20 rounded-md" />
        <div className="h-16 w-full bg-primary/10 rounded-xl" />
      </div>
    );
  }

  if (!profile) return null;

  const currentBenefits =
    activeLang === "ta"
      ? profile.benefits_ta
      : activeLang === "hi"
      ? profile.benefits_hi
      : profile.benefits_en;

  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 sm:p-6 shadow-sm overflow-hidden">
      {/* Header: Title, AI Badge & Multi-language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg flex items-center gap-1.5 text-foreground">
              AI Health & Culinary Intelligence
              <span className="rounded-full bg-primary/15 text-primary text-[10px] font-mono px-2 py-0.5 border border-primary/30">
                Cached 0ms
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Nutritional profile & coastal cooking recommendations
            </p>
          </div>
        </div>

        {/* Multi-Language Tabs */}
        <div className="inline-flex rounded-xl border border-border bg-card/80 p-1 text-xs self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveLang("en")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeLang === "en"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setActiveLang("ta")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeLang === "ta"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            தமிழ்
          </button>
          <button
            type="button"
            onClick={() => setActiveLang("hi")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeLang === "hi"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Nutrition Highlights Grid */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 text-center shadow-2xs">
          <HeartPulse className="size-4 text-rose-500 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Omega-3</p>
          <p className="text-xs sm:text-sm font-bold text-foreground truncate">{profile.omega3_level}</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 text-center shadow-2xs">
          <Dumbbell className="size-4 text-emerald-500 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lean Protein</p>
          <p className="text-xs sm:text-sm font-bold text-foreground truncate">{profile.protein_per_100g}</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 text-center shadow-2xs">
          <Flame className="size-4 text-amber-500 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Energy</p>
          <p className="text-xs sm:text-sm font-bold text-foreground truncate">{profile.calories_per_100g}</p>
        </div>
      </div>

      {/* Key Health Benefits */}
      <div className="mt-4 space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-emerald-500" />
          {activeLang === "ta" ? "முக்கிய நன்மைகள்" : activeLang === "hi" ? "प्रमुख स्वास्थ्य लाभ" : "Key Wellness Benefits"}
        </h3>
        <ul className="space-y-1.5 text-xs sm:text-sm leading-relaxed text-foreground">
          {currentBenefits.map((benefit, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-primary font-bold mt-0.5">•</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Cooking & Culinary Recommendations */}
      {profile.cooking_tips && profile.cooking_tips.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-border/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <ChefHat className="size-3.5 text-amber-500" />
            {activeLang === "ta" ? "சிறந்த சமையல் முறைகள்" : activeLang === "hi" ? "पकाने के उत्तम तरीके" : "Chef's Preparation Recommendations"}
          </h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {profile.cooking_tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5">✓</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* MANDATORY AI ADVISORY DISCLAIMER */}
      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-tight opacity-95">
          <strong>Medical & Culinary Disclaimer:</strong> This profile is generated by AI for informational purposes. Values vary by seasonal harvest and cut. Please check personal seafood allergies and verify cooking guidelines before preparation.
        </p>
      </div>
    </div>
  );
}
