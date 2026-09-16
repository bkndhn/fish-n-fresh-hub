import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, PackagePlus, ShieldCheck, Check, Loader2, Store, CheckCircle2 } from "lucide-react";
import type { VerticalConfig } from "@/lib/verticals";

export interface SmartCatalogSeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verticalConfig: VerticalConfig;
  storeName?: string | null | undefined;
  loading?: boolean | undefined;
  onConfirm: (options: { archiveExisting: boolean; keepCustomProducts: boolean }) => Promise<void>;
}

export function SmartCatalogSeedModal({
  open,
  onOpenChange,
  verticalConfig,
  storeName,
  loading = false,
  onConfirm,
}: SmartCatalogSeedModalProps) {
  // Option modes for existing & non-seeded products
  const [cleanMode, setCleanMode] = useState<"smart" | "clean" | "keep">("smart");

  const handleConfirm = async () => {
    let archiveExisting = false;
    let keepCustomProducts = true;

    if (cleanMode === "smart") {
      archiveExisting = true;
      keepCustomProducts = true; // Preserve user-added custom products, archive old template
    } else if (cleanMode === "clean") {
      archiveExisting = true;
      keepCustomProducts = false; // Fresh start, archive everything
    } else {
      archiveExisting = false;
      keepCustomProducts = true; // Keep all side-by-side
    }

    await onConfirm({ archiveExisting, keepCustomProducts });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 border-border/80 bg-card shadow-2xl backdrop-blur-md">
        <DialogHeader className="text-left space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="size-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <PackagePlus className="size-5" />
            </div>
            <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary bg-primary/5 px-2.5 py-0.5">
              ⚡ Verified Industry Catalog
            </Badge>
          </div>

          <div>
            <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
              Load {verticalConfig.name} Catalog
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Seeds 10 production-grade {verticalConfig.shortName} products into {storeName ? <strong>{storeName}</strong> : "your store"} with verified local prices, barcodes, and specs.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-2 my-2 rounded-2xl bg-muted/30 border border-border/60 p-3 text-xs">
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>10 Verified Authentic Items</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>Real Wholesale & MRP Rates</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>High-Res Photos & Specs</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>POS Barcodes & HSN Codes</span>
          </div>
        </div>

        {/* Existing & Non-Seeded Products Strategy Selector */}
        <div className="space-y-2 mt-1">
          <Label className="text-xs font-bold text-foreground uppercase tracking-wide">
            Product Catalog Strategy
          </Label>
          <RadioGroup
            value={cleanMode}
            onValueChange={(val) => setCleanMode(val as "smart" | "clean" | "keep")}
            className="space-y-2"
          >
            {/* Option A: Smart Alignment (Recommended) */}
            <div
              onClick={() => setCleanMode("smart")}
              className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition ${
                cleanMode === "smart"
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border/60 bg-muted/10 hover:bg-muted/30"
              }`}
            >
              <RadioGroupItem value="smart" id="mode-smart" className="mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  Smart Transition (Recommended)
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Safest
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Archives older template products from previous vertical, but <strong>strictly preserves all custom products</strong> you created.
                </p>
              </div>
            </div>

            {/* Option B: Clean Slate */}
            <div
              onClick={() => setCleanMode("clean")}
              className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition ${
                cleanMode === "clean"
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border/60 bg-muted/10 hover:bg-muted/30"
              }`}
            >
              <RadioGroupItem value="clean" id="mode-clean" className="mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-foreground">Clean Slate (New Store Launch)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Deactivates all existing catalog items so your store exclusively features the new {verticalConfig.shortName} catalog.
                </p>
              </div>
            </div>

            {/* Option C: Keep All */}
            <div
              onClick={() => setCleanMode("keep")}
              className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition ${
                cleanMode === "keep"
                  ? "border-primary bg-primary/5 shadow-2xs"
                  : "border-border/60 bg-muted/10 hover:bg-muted/30"
              }`}
            >
              <RadioGroupItem value="keep" id="mode-keep" className="mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-foreground">Keep Everything Side-by-Side</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Appends the new {verticalConfig.shortName} items alongside your existing products without archiving anything.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-xs font-semibold h-10 w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl text-xs font-bold h-10 w-full sm:w-auto shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Loading Catalog…
              </>
            ) : (
              <>
                <PackagePlus className="size-3.5 mr-1.5" /> Load {verticalConfig.shortName} Catalog
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
