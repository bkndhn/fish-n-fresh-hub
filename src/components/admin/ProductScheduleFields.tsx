import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAY_LABELS } from "@/lib/productSchedule";

type V = { available_from?: string | null; available_to?: string | null; available_days?: number[] | null; expiry_date?: string | null };

export function ProductScheduleFields({ value, onChange }: { value: V; onChange: (patch: V) => void }) {
  const days = value.available_days ?? [];
  const toggle = (d: number) =>
    onChange({ available_days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() });
  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-3">
      <p className="text-xs font-bold">Selling time & expiry</p>
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground uppercase">Days (none = every day)</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((l, d) => (
            <button
              key={l}
              type="button"
              onClick={() => toggle(d)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${days.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase">From</Label>
          <Input type="time" className="h-8 text-xs" value={value.available_from?.slice(0, 5) ?? ""} onChange={(e) => onChange({ available_from: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase">To</Label>
          <Input type="time" className="h-8 text-xs" value={value.available_to?.slice(0, 5) ?? ""} onChange={(e) => onChange({ available_to: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase">Expiry date</Label>
          <Input type="date" className="h-8 text-xs" value={value.expiry_date ?? ""} onChange={(e) => onChange({ expiry_date: e.target.value || null })} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">Outside these times, or after expiry, the item is hidden from the shop.</p>
    </div>
  );
}
