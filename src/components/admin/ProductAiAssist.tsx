import { useState } from "react";
import { Sparkles, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { suggestProductContent } from "@/lib/productAi.functions";
import { supabase } from "@/integrations/supabase/client";

/** Free image source (no key, no credits): builds an image URL from a prompt. */
export function freeImageUrl(prompt: string, seed: number) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=640&nologo=true&seed=${seed}`;
}

/** Template copy used when the user picks the free option (zero AI credits). */
export function freeDescriptions(name: string) {
  return [
    `Fresh ${name}, hand-picked daily and packed with care for your kitchen.`,
    `${name} — great for everyday cooking. Store chilled and use within the suggested time for best taste.`,
    `Quality-checked ${name} at a fair local price. Order online or pick up at our counter.`,
  ];
}

type Props = {
  name: string;
  category?: string;
  onUseDescription: (text: string) => void;
  onUseImage: (url: string) => void;
};

export function ProductAiAssist({ name, category, onUseDescription, onUseImage }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [descs, setDescs] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const [ownPhotos, setOwnPhotos] = useState<string[]>([]);

  /** Your own uploaded product photos whose names match — shown before any generated image. */
  const loadOwnPhotos = async (): Promise<void> => {
    const words = name.trim().split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
    if (!words.length) return setOwnPhotos([]);
    const { data } = await supabase
      .from("products")
      .select("image_url, images")
      .or(words.map((w) => `name.ilike.%${w.replace(/[%,()]/g, "")}%`).join(","))
      .limit(12);
    const urls = new Set<string>();
    for (const p of (data ?? []) as { image_url: string | null; images?: unknown }[]) {
      if (p.image_url && !p.image_url.includes("pollinations")) urls.add(p.image_url);
      if (Array.isArray(p.images)) for (const u of p.images) if (typeof u === "string" && !u.includes("pollinations")) urls.add(u);
    }
    setOwnPhotos([...urls].slice(0, 6));
  };

  const load = async (mode: "free" | "ai"): Promise<void> => {
    if (name.trim().length < 2) { toast.error("Type the product name first"); return; }
    setOpen(true);
    void loadOwnPhotos();
    const seed = Math.floor(Math.random() * 1e6);
    if (mode === "free") {
      setDescs(freeDescriptions(name.trim()));
      setImages([0, 1, 2].map((i) => freeImageUrl(`fresh ${name} product photo, plain background`, seed + i)));
      return;
    }
    setLoading(true);
    const r = await suggestProductContent({ data: { name: name.trim(), category } }).catch(() => null);
    setLoading(false);
    if (!r || r.error) {
      toast.error(r?.error ?? "Suggestions are unavailable right now. Showing free options.");
      return load("free");
    }
    setDescs(r.descriptions);
    setImages(r.image_prompts.map((p, i) => freeImageUrl(p, seed + i)));
  };

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => load("free")}>
          <Sparkles className="size-3.5" /> Suggest photo & text (free)
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => load("ai")}>
          <Sparkles className="size-3.5" /> Smart AI suggest
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">Suggestions for “{name}”</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={loading} onClick={() => load("free")}>
            <RefreshCw className="size-3" /> New (free)
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={loading} onClick={() => load("ai")}>
            <Sparkles className="size-3" /> New (AI)
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setOpen(false)}>
            <X className="size-3" /> Leave it
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Thinking…</div>
      ) : (
        <>
          {ownPhotos.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold">Your real shop photos</p>
              <div className="grid grid-cols-3 gap-2">
                {ownPhotos.map((src) => (
                  <button key={src} type="button" className="relative rounded-lg overflow-hidden border-2 border-primary aspect-square bg-muted"
                    onClick={() => { onUseImage(src); toast.success("Your photo applied"); }}>
                    <img src={src} alt={`${name} shop photo`} loading="lazy" className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-background/85 text-[10px] font-bold py-1 flex items-center justify-center gap-1">
                      <Check className="size-3" /> Use it
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-bold pt-1">Generated ideas</p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Tip: upload your own photo with the image box above — it always beats a generated one.</p>
          <div className="grid grid-cols-3 gap-2">
            {images.map((src) => (
              <button
                key={src}
                type="button"
                className="group relative rounded-lg overflow-hidden border border-border aspect-square bg-muted"
                onClick={() => { onUseImage(src); toast.success("Photo applied"); }}
              >
                <img src={src} alt={`${name} suggestion`} loading="lazy" className="size-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-background/85 text-[10px] font-bold py-1 flex items-center justify-center gap-1">
                  <Check className="size-3" /> Use it
                </span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {descs.map((d) => (
              <div key={d} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
                <p className="text-xs flex-1">{d}</p>
                <Button type="button" size="sm" className="h-7 text-xs shrink-0" onClick={() => { onUseDescription(d); toast.success("Description applied"); }}>
                  Use it
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
