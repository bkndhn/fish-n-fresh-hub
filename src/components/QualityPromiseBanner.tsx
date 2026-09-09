import { Award, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface QualityPromiseBannerProps {
  variant?: "full" | "compact" | "badge";
  className?: string;
  verticalEmoji?: string;
}

export function QualityPromiseBanner({
  variant = "full",
  className = "",
  verticalEmoji = "🐟",
}: QualityPromiseBannerProps) {
  const { t, lang, setLang } = useTranslation();

  if (variant === "badge") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shadow-2xs ${className}`}
      >
        <ShieldCheck className="size-3.5 text-primary shrink-0" />
        <span className="truncate">{t("promise.motto")}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`w-full max-w-full overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-3 text-center shadow-2xs ${className}`}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-base shrink-0">{verticalEmoji}</span>
          <p className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
            {t("promise.motto")}
          </p>
          <Sparkles className="size-3.5 text-amber-500 shrink-0 hidden sm:inline" />
        </div>
      </div>
    );
  }

  return (
    <section
      className={`w-full max-w-full overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-3.5 sm:p-4.5 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs text-lg">
            {verticalEmoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                <ShieldCheck className="size-3" />
                {t("promise.badge")}
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline font-medium">
                • 100% Certified Assurance
              </span>
            </div>
            <h3 className="mt-1 text-sm sm:text-base font-extrabold text-foreground tracking-tight leading-snug break-words">
              {t("promise.motto")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground leading-normal break-words">
              {t("promise.sub")}
            </p>
          </div>
        </div>

        {/* Trilingual Quick-Switch Buttons */}
        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center bg-muted/50 p-1 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              lang === "en"
                ? "bg-background text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="English"
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("ta")}
            className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              lang === "ta"
                ? "bg-background text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="தமிழ் (Tamil)"
          >
            தமிழ்
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-all ${
              lang === "hi"
                ? "bg-background text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="हिन्दी (Hindi)"
          >
            हिन्दी
          </button>
        </div>
      </div>
    </section>
  );
}
