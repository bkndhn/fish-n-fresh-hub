import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sliders, Plus, Trash2, Edit2, Check, X, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface PortionChip {
  label: string;
  val: number; // in kg
}

export const DEFAULT_PORTION_CHIPS: PortionChip[] = [
  { label: "100g", val: 0.1 },
  { label: "250g", val: 0.25 },
  { label: "350g", val: 0.35 },
  { label: "500g", val: 0.5 },
  { label: "750g", val: 0.75 },
  { label: "1 kg", val: 1.0 },
  { label: "1.5 kg", val: 1.5 },
  { label: "2 kg", val: 2.0 },
  { label: "3 kg", val: 3.0 },
  { label: "5 kg", val: 5.0 },
];

export function getStoredPortionChips(customKey?: string): PortionChip[] {
  if (typeof window === "undefined") return DEFAULT_PORTION_CHIPS;
  try {
    if (customKey) {
      const custom = localStorage.getItem(`fnf_pos_chips_${customKey}`);
      if (custom) return JSON.parse(custom);
    }
    const global = localStorage.getItem("fnf_pos_global_chips");
    if (global) return JSON.parse(global);
  } catch {
    /* fallback */
  }
  return DEFAULT_PORTION_CHIPS;
}

export function PortionChipsModal({
  open,
  onClose,
  chips,
  onUpdateChips,
}: {
  open: boolean;
  onClose: () => void;
  chips: PortionChip[];
  onUpdateChips: (updated: PortionChip[]) => void;
}) {
  const [newVal, setNewVal] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [unitMode, setUnitMode] = useState<"g" | "kg">("g");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const handleAdd = () => {
    const raw = parseFloat(newVal);
    if (isNaN(raw) || raw <= 0) {
      toast.error("Please enter a valid positive weight amount");
      return;
    }

    const valInKg = unitMode === "g" ? raw / 1000 : raw;
    const computedLabel = newLabel.trim() || (valInKg < 1 ? `${Math.round(valInKg * 1000)}g` : `${valInKg} kg`);

    if (chips.some((c) => Math.abs(c.val - valInKg) < 0.001)) {
      toast.error(`A portion chip with weight ${valInKg} kg already exists`);
      return;
    }

    const updated = [...chips, { label: computedLabel, val: valInKg }].sort((a, b) => a.val - b.val);
    onUpdateChips(updated);
    setNewVal("");
    setNewLabel("");
    toast.success(`Portion chip "${computedLabel}" added successfully!`);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditVal(chips[index].val.toString());
    setEditLabel(chips[index].label);
  };

  const handleSaveEdit = (index: number) => {
    const raw = parseFloat(editVal);
    if (isNaN(raw) || raw <= 0) {
      toast.error("Please enter a valid weight in kg");
      return;
    }
    const updated = [...chips];
    updated[index] = {
      val: raw,
      label: editLabel.trim() || (raw < 1 ? `${Math.round(raw * 1000)}g` : `${raw} kg`),
    };
    updated.sort((a, b) => a.val - b.val);
    onUpdateChips(updated);
    setEditingIndex(null);
    toast.success("Portion chip updated");
  };

  const handleDelete = (val: number) => {
    if (chips.length <= 1) {
      toast.error("You must keep at least 1 portion chip");
      return;
    }
    const updated = chips.filter((c) => c.val !== val);
    onUpdateChips(updated);
    toast.success("Portion chip removed");
  };

  const handleResetDefaults = () => {
    onUpdateChips(DEFAULT_PORTION_CHIPS);
    toast.success("Reset to universal standard presets (100g to 5kg)");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-5 sm:p-6 border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Sliders className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Universal Portion Chips Manager
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Manage fast one-click portion buttons available across all catalog products and counter billing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Add New Chip Form */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-3 mt-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-foreground">
              <Plus className="size-3.5 text-primary" /> Add New Portion Preset
            </span>
            <div className="inline-flex rounded-lg border border-border/80 p-0.5 bg-background text-[11px]">
              <button
                type="button"
                onClick={() => setUnitMode("g")}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                  unitMode === "g" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Grams (g)
              </button>
              <button
                type="button"
                onClick={() => setUnitMode("kg")}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                  unitMode === "kg" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Kilograms (kg)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Weight Amount ({unitMode})
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={unitMode === "g" ? "e.g. 400 or 800" : "e.g. 0.4 or 1.25"}
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                className="h-8 text-xs font-mono bg-background rounded-xl"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                Button Display Label (Optional)
              </label>
              <Input
                placeholder={unitMode === "g" ? "e.g. 400g" : "e.g. 1.25 kg"}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-8 text-xs bg-background rounded-xl"
              />
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            className="w-full h-8 text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5 shadow-2xs"
          >
            <Plus className="size-3.5" /> Add Portion Chip
          </Button>
        </div>

        {/* Existing Active Chips List */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Active Portion Presets ({chips.length})
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              className="h-7 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 px-2 gap-1"
            >
              <RotateCcw className="size-3" /> Reset Standard Presets
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chips.map((chip, idx) => {
              const isEditing = editingIndex === idx;

              if (isEditing) {
                return (
                  <div
                    key={chip.val}
                    className="p-2.5 rounded-xl border border-primary/40 bg-primary/5 flex items-center gap-1.5 shadow-2xs"
                  >
                    <div className="flex-1 space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        placeholder="kg"
                        className="h-7 text-xs font-mono bg-background rounded-lg"
                      />
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                        className="h-7 text-xs bg-background rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(idx)}
                        className="h-7 w-7 p-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                        title="Save"
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingIndex(null)}
                        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                        title="Cancel"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={chip.val}
                  className="p-2 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg">
                      {chip.label}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {chip.val >= 1 ? `${chip.val} kg` : `${Math.round(chip.val * 1000)}g`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(idx)}
                      className="size-7 p-0 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title="Edit portion"
                    >
                      <Edit2 className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(chip.val)}
                      className="size-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete portion"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-border/60 flex items-center justify-end">
          <Button
            type="button"
            className="rounded-xl px-5 h-8.5 font-bold text-xs"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
