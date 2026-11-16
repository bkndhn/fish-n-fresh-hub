import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, RotateCcw, X } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, productsQuery } from "@/lib/queries";
import { DEFAULT_HOME_LAYOUT, HOME_SECTION_LABELS, moveSection, normalizeHomeLayout, type HomeLayout } from "@/lib/homeLayout";

export const Route = createFileRoute("/_authenticated/admin/home-layout")({
  head: () => ({ meta: [{ title: "Home Page Layout | Fish N Fresh Admin" }, { name: "description", content: "Choose and order the sections on the shop home page." }] }),
  component: HomeLayoutPage,
});

function HomeLayoutPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const { data: products } = useQuery(productsQuery());
  const [layout, setLayout] = useState<HomeLayout>(DEFAULT_HOME_LAYOUT);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (settings) setLayout(normalizeHomeLayout((settings as { home_layout?: unknown }).home_layout));
  }, [settings]);

  const save = async () => {
    if (!settings?.id) return;
    setSaving(true);
    const { error } = await supabase.from("store_settings").update({ home_layout: layout as never }).eq("id", settings.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Home page updated");
    qc.invalidateQueries({ queryKey: ["store_settings"] });
  };

  const patch = (i: number, p: Partial<HomeLayout["sections"][number]>) =>
    setLayout((l) => ({ ...l, sections: l.sections.map((s, k) => (k === i ? { ...s, ...p } : s)) }));
  const matches = search.length > 1 ? (products ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && !layout.pinnedProductIds.includes(p.id)).slice(0, 6) : [];

  return (
    <AdminShell title="Home Page Layout">
      <div className="max-w-2xl space-y-5">
        <p className="text-sm text-muted-foreground">Turn sections on or off, rename them and use the arrows to choose what shows first on the shop home page.</p>
        <div className="space-y-2">
          {layout.sections.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
              <div className="flex flex-col">
                <button aria-label="Move up" onClick={() => setLayout((l) => moveSection(l, i, -1))} disabled={i === 0} className="disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button aria-label="Move down" onClick={() => setLayout((l) => moveSection(l, i, 1))} disabled={i === layout.sections.length - 1} className="disabled:opacity-30"><ArrowDown className="size-4" /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground">{HOME_SECTION_LABELS[s.id]}</p>
                {s.id !== "collections" && (
                  <Input value={s.title} onChange={(e) => patch(i, { title: e.target.value })} className="mt-1 h-8" aria-label={`${HOME_SECTION_LABELS[s.id]} title`} />
                )}
              </div>
              <Switch checked={s.enabled} onCheckedChange={(v) => patch(i, { enabled: v })} aria-label={`Show ${HOME_SECTION_LABELS[s.id]}`} />
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-card p-3 space-y-2">
          <p className="text-sm font-semibold">"Just added / updated" shows</p>
          <div className="flex flex-wrap gap-2">
            {(["added", "edited"] as const).map((m) => (
              <Button key={m} size="sm" variant={layout.recentMode === m ? "default" : "outline"} onClick={() => setLayout((l) => ({ ...l, recentMode: m }))}>
                {m === "added" ? "Newly added items" : "Recently edited items"}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">From the last
            <Input type="number" min={1} max={365} value={layout.recentDays} onChange={(e) => setLayout((l) => ({ ...l, recentDays: Number(e.target.value) || 1 }))} className="h-8 w-20" /> days
          </label>
        </div>

        <div className="rounded-xl border bg-card p-3 space-y-2">
          <p className="text-sm font-semibold">Pinned items (shown in "Picked by us")</p>
          <div className="flex flex-wrap gap-1.5">
            {layout.pinnedProductIds.map((id) => {
              const p = products?.find((x) => x.id === id);
              return (
                <span key={id} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                  {p?.name ?? "Removed item"}
                  <button aria-label="Unpin" onClick={() => setLayout((l) => ({ ...l, pinnedProductIds: l.pinnedProductIds.filter((x) => x !== id) }))}><X className="size-3" /></button>
                </span>
              );
            })}
          </div>
          <Input placeholder="Search a product to pin…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {matches.map((p) => (
            <button key={p.id} className="block w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-muted"
              onClick={() => { setLayout((l) => ({ ...l, pinnedProductIds: [...l.pinnedProductIds, p.id] })); setSearch(""); }}>
              + {p.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save home page"}</Button>
          <Button variant="outline" onClick={() => setLayout(DEFAULT_HOME_LAYOUT)}><RotateCcw className="mr-1 size-4" />Reset</Button>
        </div>
      </div>
    </AdminShell>
  );
}
