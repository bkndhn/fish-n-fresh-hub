import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, subtitle, icon, action }: { eyebrow?: string; title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <header className="page-hero mb-5 flex items-center gap-3 px-4 py-4 sm:px-5 sm:py-5">
      {icon && <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-soft">{icon}</span>}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
        <h1 className="truncate text-2xl font-extrabold leading-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
