import {
  Award,
  Clock,
  Fish,
  Leaf,
  PackageCheck,
  Phone,
  Percent,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Truck,
  Waves,
  type LucideIcon,
} from "lucide-react";

export const BADGE_ICONS: Record<string, LucideIcon> = {
  waves: Waves,
  "shield-check": ShieldCheck,
  truck: Truck,
  fish: Fish,
  snowflake: Snowflake,
  clock: Clock,
  award: Award,
  leaf: Leaf,
  "package-check": PackageCheck,
  phone: Phone,
  percent: Percent,
  sparkles: Sparkles,
};

export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = BADGE_ICONS[name] ?? Sparkles;
  return <Icon className={className} />;
}

export function TrustBadges({ badges }: { badges: { id: string; label: string; icon: string }[] }) {
  if (!badges.length) return null;
  return (
    <section className="w-full max-w-full overflow-hidden">
      <div 
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(badges.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {badges.slice(0, 4).map((b) => (
          <div
            key={b.id}
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card/90 px-1.5 py-2 text-center text-[10px] sm:text-[11px] leading-tight shadow-2xs"
          >
            <BadgeIcon name={b.icon} className="size-3.5 sm:size-4 text-primary shrink-0" />
            <span className="line-clamp-2 font-medium break-words text-foreground">{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
