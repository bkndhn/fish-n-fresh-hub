import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Copy,
  Percent,
  IndianRupee,
  Search,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPromotionsQuery, type PromotionRow } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions & Offers | Fish N Fresh Admin" },
      { name: "description", content: "Create and customize seafood discount codes, campaigns, and validity periods." },
    ],
  }),
  component: PromotionsAdmin,
});

type PromoFormData = {
  id?: string;
  name: string;
  code: string;
  discount_type: "percent" | "fixed";
  value: number;
  min_order: number;
  valid_from: string;
  valid_to: string;
  description: string;
  active: boolean;
};

const INITIAL_FORM: PromoFormData = {
  name: "",
  code: "",
  discount_type: "percent",
  value: 10,
  min_order: 0,
  valid_from: "",
  valid_to: "",
  description: "",
  active: true,
};

function PromotionsAdmin() {
  const qc = useQueryClient();
  const promos = useQuery(adminPromotionsQuery);
  const rows = promos.data ?? [];

  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "scheduled" | "expired" | "paused">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PromoFormData>(INITIAL_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Toggle quick active status
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("promotions").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promotion status updated");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Save (Create or Update) mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PromoFormData) => {
      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase() || null,
        discount_type: data.discount_type,
        value: Number(data.value) || 0,
        min_order: Number(data.min_order) || 0,
        valid_from: data.valid_from ? new Date(data.valid_from).toISOString() : null,
        valid_to: data.valid_to ? new Date(data.valid_to).toISOString() : null,
        description: data.description.trim() || null,
        active: data.active,
        type: "discount",
      };

      if (data.id) {
        const { error } = await (supabase as any).from("promotions").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("promotions").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(formData.id ? "Promotion updated" : "Promotion created successfully");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      setDialogOpen(false);
      setFormData(INITIAL_FORM);
    },
    onError: (e: any) => {
      toast.error(`Failed to save promotion: ${e.message || "Unknown error"}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promotion deleted");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(`Failed to delete promotion: ${e.message || "Unknown error"}`);
    },
  });

  const openCreate = () => {
    setFormData(INITIAL_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: PromotionRow) => {
    setFormData({
      id: p.id,
      name: p.name,
      code: p.code || "",
      discount_type: p.discount_type === "percentage" ? "percent" : (p.discount_type as "percent" | "fixed") || "percent",
      value: Number(p.value),
      min_order: Number(p.min_order || 0),
      valid_from: p.valid_from ? p.valid_from.slice(0, 16) : "",
      valid_to: p.valid_to ? p.valid_to.slice(0, 16) : "",
      description: p.description || "",
      active: p.active,
    });
    setDialogOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Coupon code ${code} copied!`);
  };

  // Determine promo validity state
  const getStatus = (p: PromotionRow) => {
    const now = new Date();
    if (!p.active) return "paused";
    if (p.valid_to && new Date(p.valid_to) < now) return "expired";
    if (p.valid_from && new Date(p.valid_from) > now) return "scheduled";
    return "active";
  };

  // Filtered rows
  const filtered = rows.filter((p) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.code && p.code.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    const status = getStatus(p);
    if (filterTab === "active") return status === "active";
    if (filterTab === "scheduled") return status === "scheduled";
    if (filterTab === "expired") return status === "expired";
    if (filterTab === "paused") return status === "paused";

    return true;
  });

  return (
    <AdminShell title="Promotions & Offers">
      {/* Top Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Manage coupons, discount percentages, date validity periods, and store offers.
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-xl self-start sm:self-auto">
          <Plus className="mr-1.5 size-4" /> Create Promotion
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupon code or name..."
            className="pl-9 pr-8 rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "active", "scheduled", "expired", "paused"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={filterTab === tab ? "default" : "outline"}
              className="rounded-xl capitalize text-xs h-8"
              onClick={() => setFilterTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      {/* Promotion Cards */}
      <div className="space-y-3">
        {filtered.map((p) => {
          const status = getStatus(p);
          const isPercent = p.discount_type === "percent" || p.discount_type === "percentage";

          return (
            <Card key={p.id} className="transition hover:border-primary/40">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-base text-foreground">{p.name}</span>

                    {p.code && (
                      <button
                        type="button"
                        onClick={() => copyCode(p.code!)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary hover:bg-primary/20 transition"
                        title="Click to copy code"
                      >
                        <Tag className="size-3" />
                        {p.code}
                        <Copy className="size-3 ml-0.5 opacity-60" />
                      </button>
                    )}

                    {status === "active" && (
                      <Badge className="bg-green-600 hover:bg-green-600 text-[10px]">Active</Badge>
                    )}
                    {status === "scheduled" && (
                      <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px]">
                        Scheduled
                      </Badge>
                    )}
                    {status === "expired" && (
                      <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                    )}
                    {status === "paused" && (
                      <Badge variant="secondary" className="text-[10px]">Paused</Badge>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {isPercent ? `${p.value}% OFF` : `${formatINR(p.value)} OFF`}
                    </span>
                    <span>•</span>
                    <span>Min order: {formatINR(p.min_order)}</span>
                    {p.description && (
                      <>
                        <span>•</span>
                        <span className="italic truncate max-w-xs">{p.description}</span>
                      </>
                    )}
                  </div>

                  {/* Validity Period */}
                  {(p.valid_from || p.valid_to) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="size-3 text-primary" />
                      <span>
                        {p.valid_from ? `From: ${formatIST(p.valid_from)}` : "Starts: Immediately"}
                      </span>
                      <span>—</span>
                      <span>
                        {p.valid_to ? `Expires: ${formatIST(p.valid_to)}` : "No expiration"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Active</span>
                    <Switch
                      checked={p.active}
                      onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                      disabled={toggle.isPending}
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl px-2.5 text-xs"
                      onClick={() => openEdit(p)}
                    >
                      <Edit2 className="size-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-xl px-2.5 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No promotions found matching your filter.
          </div>
        )}
      </div>

      {/* Create / Edit Promotion Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formData.id ? "Edit Promotion" : "Create New Promotion"}</DialogTitle>
            <DialogDescription>
              Configure discount percentage or flat amount, validity dates, and min orders.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formData.name.trim()) {
                toast.error("Promotion name is required");
                return;
              }
              if (formData.value <= 0) {
                toast.error("Discount value must be greater than 0");
                return;
              }
              saveMutation.mutate(formData);
            }}
            className="space-y-4 py-2"
          >
            <div>
              <Label className="text-xs">Promotion Name *</Label>
              <Input
                placeholder="e.g. Weekend Catch 20% Off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Coupon Code (Optional)</Label>
                <Input
                  placeholder="e.g. FRESH20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="mt-1 rounded-xl uppercase font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v: "percent" | "fixed") => setFormData({ ...formData, discount_type: v })}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Flat Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  Discount Value ({formData.discount_type === "percent" ? "%" : "₹"}) *
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={formData.discount_type === "percent" ? "100" : undefined}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  className="mt-1 rounded-xl"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Minimum Order Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.min_order}
                  onChange={(e) => setFormData({ ...formData, min_order: Number(e.target.value) })}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            {/* Date Periods */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="size-3 text-primary" /> Valid From
                </Label>
                <Input
                  type="datetime-local"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="size-3 text-primary" /> Valid To (Expiry)
                </Label>
                <Input
                  type="datetime-local"
                  value={formData.valid_to}
                  onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description / Terms</Label>
              <Textarea
                placeholder="Optional customer-facing description or terms..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 rounded-xl resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3">
              <div>
                <p className="text-xs font-semibold">Enable Promotion Now</p>
                <p className="text-[11px] text-muted-foreground">Active promotions can be applied at checkout.</p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(active) => setFormData({ ...formData, active })}
              />
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : formData.id ? "Update Offer" : "Create Offer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this offer? Any checkout with this code will no longer receive a discount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
