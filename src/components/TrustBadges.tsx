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
  const scroll = badges.length > 4;
  return (
    <section
      className={
        scroll
          ? "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          : "grid gap-2"
      }
      style={scroll ? undefined : { gridTemplateColumns: `repeat(${badges.length}, minmax(0, 1fr))` }}
    >
      {badges.map((b) => (
        <div
          key={b.id}
          className="flex min-w-[92px] flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-2 text-center text-[11px] leading-tight"
        >
          <BadgeIcon name={b.icon} className="size-4 text-primary" />
          <span className="line-clamp-2">{b.label}</span>
        </div>
      ))}
    </section>
  );
}
