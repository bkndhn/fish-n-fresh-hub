import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Edit2,
  Trash2,
  Radio,
  Sliders,
} from "lucide-react";
import {
  branchesQuery,
  generateBranchSlug,
  generateBranchCode,
  updateBranch,
  deleteBranch,
  type Branch,
} from "@/lib/multiBranch";
import {
  tenantQuotasQuery,
  checkBranchQuotaAvailable,
  createBranchWithQuotaGuard,
} from "@/lib/superAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";

export function BranchManagement() {
  const qc = useQueryClient();

  const { data: branches = [], isLoading: branchesLoading } = useQuery(branchesQuery);
  const { data: quotas, isLoading: quotasLoading } = useQuery(tenantQuotasQuery);

  const activeBranches = branches.filter((b) => b.is_active);
  const maxBranches = quotas?.max_branches ?? 10;
  const isLocked = quotas?.is_locked ?? false;

  const quotaCheck = checkBranchQuotaAvailable(activeBranches.length, maxBranches);

  // Add Branch modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addSlug, setAddSlug] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addRadiusKm, setAddRadiusKm] = useState(12);
  const [addOpenTime, setAddOpenTime] = useState("06:00");
  const [addCloseTime, setAddCloseTime] = useState("22:00");
  const [addIsDefault, setAddIsDefault] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit Branch modal state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRadiusKm, setEditRadiusKm] = useState(12);
  const [editOpenTime, setEditOpenTime] = useState("06:00");
  const [editCloseTime, setEditCloseTime] = useState("22:00");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Branch state
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleNameChangeForAdd = (name: string) => {
    setAddName(name);
    if (!addCode || addCode === generateBranchCode(addName)) {
      setAddCode(generateBranchCode(name));
    }
    if (!addSlug || addSlug === generateBranchSlug(addName)) {
      setAddSlug(generateBranchSlug(name));
    }
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setEditName(branch.name);
    setEditCode(branch.code);
    setEditSlug(branch.slug);
    setEditAddress(branch.address || "");
    setEditPhone(branch.phone || "");
    setEditRadiusKm(branch.delivery_radius_km || 12);
    setEditOpenTime(branch.open_time || "06:00");
    setEditCloseTime(branch.close_time || "22:00");
    setEditIsActive(branch.is_active);
    setEditIsDefault(branch.is_default);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      toast.error("Hub name is required");
      return;
    }

    if (isLocked) {
      toast.error("Tenant is currently locked by Platform Super Admin.");
      return;
    }

    if (!quotaCheck.allowed) {
      toast.error(quotaCheck.message || "Branch quota limit reached");
      return;
    }

    setSavingAdd(true);
    try {
      const code = addCode.trim().toUpperCase() || generateBranchCode(addName);
      const slug = addSlug.trim().toLowerCase() || generateBranchSlug(addName);

      const res = await createBranchWithQuotaGuard({
        name: addName.trim(),
        code,
        slug,
        address: addAddress.trim() || "Tamil Nadu",
        phone: addPhone.trim() || null,
        delivery_radius_km: Number(addRadiusKm) || 12,
        open_time: addOpenTime,
        close_time: addCloseTime,
        is_active: true,
        is_default: addIsDefault,
        lat: 13.0827,
        lng: 80.2707,
        sort_order: branches.length + 1,
        manager: null,
        manager_user_id: null,
        gstin: null,
        fssai_license: null,
        upi_id: null,
        min_order_amount: 199,
      });

      if (res.success && res.branch) {
        toast.success(`Store hub "${res.branch.name}" created successfully!`);
        setAddModalOpen(false);
        setAddName("");
        setAddCode("");
        setAddSlug("");
        setAddAddress("");
        setAddPhone("");
        setAddIsDefault(false);
        await qc.invalidateQueries({ queryKey: ["branches"] });
        await qc.invalidateQueries({ queryKey: ["super-admin"] });
      } else {
        toast.error(res.message || "Failed to create branch");
      }
    } finally {
      setSavingAdd(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setSavingEdit(true);
    try {
      const res = await updateBranch(editingBranch.id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        slug: editSlug.trim().toLowerCase(),
        address: editAddress.trim(),
        phone: editPhone.trim(),
        delivery_radius_km: Number(editRadiusKm),
        open_time: editOpenTime,
        close_time: editCloseTime,
        is_active: editIsActive,
        is_default: editIsDefault,
      });

      if (res.success) {
        toast.success(`Branch "${editName}" updated successfully`);
        setEditingBranch(null);
        await qc.invalidateQueries({ queryKey: ["branches"] });
        await qc.invalidateQueries({ queryKey: ["super-admin"] });
      } else {
        toast.error(res.message || "Failed to update branch");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBranch) return;
    setDeleting(true);
    try {
      const res = await deleteBranch(deletingBranch.id, deletingBranch.is_default);
      if (res.success) {
        toast.success(`Branch "${deletingBranch.name}" deleted`);
        setDeletingBranch(null);
        await qc.invalidateQueries({ queryKey: ["branches"] });
        await qc.invalidateQueries({ queryKey: ["super-admin"] });
      } else {
        toast.error(res.message || "Failed to delete branch");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    try {
      const res = await updateBranch(branch.id, { is_active: !branch.is_active });
      if (res.success) {
        toast.success(`Branch "${branch.name}" is now ${!branch.is_active ? "Active" : "Paused"}`);
        await qc.invalidateQueries({ queryKey: ["branches"] });
      } else {
        toast.error(res.message || "Failed to toggle status");
      }
    } catch {
      toast.error("Failed to toggle branch status");
    }
  };

  const utilizationPct = Math.min(100, Math.round((activeBranches.length / maxBranches) * 100));

  return (
    <Card className="border-border/80 shadow-xs bg-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Store className="size-4" />
              </span>
              <CardTitle className="text-lg font-bold">Store Branches &amp; Fulfillment Hubs</CardTitle>
              <Badge
                variant="outline"
                className={
                  quotaCheck.allowed
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                    : "border-destructive/40 bg-destructive/10 text-destructive text-xs font-semibold"
                }
              >
                {activeBranches.length} / {maxBranches} Hubs Active
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              Self-service store hub management. Add, edit, or configure delivery SLA radiuses and operating hours within your allocated platform quota.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setAddModalOpen(true)}
              disabled={!quotaCheck.allowed || isLocked}
              className="rounded-xl text-xs font-bold gap-1.5 h-9 shadow-2xs"
            >
              <Plus className="size-3.5" />
              <span>Add Store Branch</span>
            </Button>
          </div>
        </div>

        {/* Quota Usage Bar & Governance Info */}
        <div className="mt-3.5 rounded-2xl border border-border/70 bg-muted/20 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Sliders className="size-3.5 text-primary" />
              Branch Quota Headroom
            </span>
            <span className="font-mono font-bold text-muted-foreground">
              {quotaCheck.remaining} of {maxBranches} slots available
            </span>
          </div>

          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                utilizationPct >= 100
                  ? "bg-destructive"
                  : utilizationPct >= 80
                  ? "bg-amber-500"
                  : "bg-primary"
              }`}
              style={{ width: `${Math.max(5, utilizationPct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
              Branch Limit: <strong className="text-foreground font-semibold">{maxBranches} hubs</strong> (Configured by Platform Super Admin)
            </span>
            <span className="capitalize font-medium">
              Plan: {quotas?.tier || "Enterprise"}
            </span>
          </div>
        </div>

        {/* Warning if Quota Exhausted */}
        {!quotaCheck.allowed && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Branch Quota Reached ({activeBranches.length}/{maxBranches}):</span> Your organization has utilized all physical and cloud fulfillment hub slots provisioned by the Super Admin. Contact your platform administrator to increase your branch limit.
            </div>
          </div>
        )}

        {isLocked && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            <Lock className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Tenant Frozen:</span> Platform Super Admin has temporarily locked this tenant. Existing hubs remain operational, but provisioning is paused.
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {branchesLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading branch registry...</div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center border rounded-2xl border-dashed space-y-2">
            <Store className="size-8 text-muted-foreground mx-auto" />
            <p className="text-xs font-semibold">No store branches created yet.</p>
            <p className="text-[11px] text-muted-foreground">Click "Add Store Branch" above to provision your flagship dock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
                <tr>
                  <th className="p-3">Store Hub</th>
                  <th className="p-3">Code / Slug</th>
                  <th className="p-3">Delivery Zone</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{branch.name}</span>
                        {branch.is_default && (
                          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[9px] py-0 px-1 font-bold">
                            Flagship Dock
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {branch.address || "Tamil Nadu, India"}
                      </p>
                      {branch.phone && (
                        <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="size-2.5" /> {branch.phone}
                        </p>
                      )}
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      <span className="font-bold text-foreground">{branch.code}</span>
                      <span className="text-muted-foreground block text-[10px]">/{branch.slug}</span>
                    </td>

                    <td className="p-3">
                      <span className="font-semibold text-foreground">{branch.delivery_radius_km} km</span>
                      <span className="text-muted-foreground block text-[10px]">Geofenced SLA</span>
                    </td>

                    <td className="p-3 text-muted-foreground">
                      <div className="flex items-center gap-1 font-medium">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>{branch.open_time || "06:00"} – {branch.close_time || "22:00"}</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(branch)}
                        className="cursor-pointer"
                        title="Click to toggle Active / Paused"
                      >
                        <Badge
                          variant="outline"
                          className={`text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${
                            branch.is_active
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-muted text-muted-foreground bg-muted/30"
                          }`}
                        >
                          {branch.is_active ? "● Active" : "○ Paused"}
                        </Badge>
                      </button>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(branch)}
                          className="h-7 text-[11px] hover:bg-muted rounded-lg font-semibold px-2 gap-1"
                          title="Edit Hub Parameters"
                        >
                          <Edit2 className="size-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingBranch(branch)}
                          className="h-7 text-[11px] text-destructive hover:bg-destructive/10 rounded-lg font-semibold px-2 gap-1"
                          title="Delete Hub"
                        >
                          <Trash2 className="size-3" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Add Store Branch Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-h-[88vh] flex flex-col p-0 rounded-2xl sm:max-w-md overflow-hidden mx-auto">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Store className="size-4.5 text-primary" />
              Add Store Branch / Fulfillment Hub
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provision a new store location within your allocated Super Admin quota ({activeBranches.length}/{maxBranches} used).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAdd} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3.5">
              <div>
                <Label className="text-xs font-bold">Branch / Hub Name *</Label>
                <Input
                  value={addName}
                  onChange={(e) => handleNameChangeForAdd(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                  placeholder="e.g. Velachery Express Hub"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-bold">Store Code (3 Chars) *</Label>
                  <Input
                    maxLength={4}
                    value={addCode}
                    onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                    className="mt-1 rounded-xl text-xs font-mono uppercase"
                    placeholder="VEL"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">URL Slug *</Label>
                  <Input
                    value={addSlug}
                    onChange={(e) => setAddSlug(e.target.value.toLowerCase())}
                    className="mt-1 rounded-xl text-xs font-mono"
                    placeholder="velachery"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Physical Address / Landmark</Label>
                <Input
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                  placeholder="e.g. 100 Feet Bypass Road, Velachery, Chennai"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-bold">Contact Phone</Label>
                  <Input
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Delivery SLA Radius (km)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={addRadiusKm}
                    onChange={(e) => setAddRadiusKm(parseInt(e.target.value) || 12)}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-bold">Opening Time</Label>
                  <Input
                    type="time"
                    value={addOpenTime}
                    onChange={(e) => setAddOpenTime(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Closing Time</Label>
                  <Input
                    type="time"
                    value={addCloseTime}
                    onChange={(e) => setAddCloseTime(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/80 bg-muted/20">
                <label className="flex items-center justify-between cursor-pointer text-xs font-medium">
                  <div>
                    <span className="font-semibold block">Designate as Flagship / Default Dock</span>
                    <span className="text-[10px] text-muted-foreground">Default store for visitors outside delivery geofence</span>
                  </div>
                  <Switch
                    checked={addIsDefault}
                    onCheckedChange={setAddIsDefault}
                  />
                </label>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-border/60 shrink-0 bg-background/95 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingAdd || !addName.trim() || !quotaCheck.allowed}
                className="rounded-xl text-xs font-bold h-9 px-4 shadow-xs"
              >
                {savingAdd ? "Creating Hub..." : "Create Store Hub"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Store Branch Dialog */}
      <Dialog open={Boolean(editingBranch)} onOpenChange={(open) => !open && setEditingBranch(null)}>
        <DialogContent className="max-h-[88vh] flex flex-col p-0 rounded-2xl sm:max-w-md overflow-hidden mx-auto">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Store className="size-4.5 text-primary" />
              Edit Store Hub: {editingBranch?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update operational parameters, delivery SLA radius, hours, and status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3.5">
              <div>
                <Label className="text-xs font-bold">Hub Name *</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-bold">Store Code *</Label>
                  <Input
                    maxLength={4}
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="mt-1 rounded-xl text-xs font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">URL Slug *</Label>
                  <Input
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                    className="mt-1 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Physical Address / Landmark</Label>
                <Input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                  placeholder="e.g. Kasimedu Harbour Road, Chennai"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-bold">Contact Phone</Label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Delivery SLA Radius (km)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={editRadiusKm}
                    onChange={(e) => setEditRadiusKm(Number(e.target.value))}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-bold">Opening Time</Label>
                  <Input
                    type="time"
                    value={editOpenTime}
                    onChange={(e) => setEditOpenTime(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Closing Time</Label>
                  <Input
                    type="time"
                    value={editCloseTime}
                    onChange={(e) => setEditCloseTime(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2.5 pt-2">
                <label className="flex items-center justify-between cursor-pointer text-xs font-medium">
                  <span>Hub Operating Status</span>
                  <div className="flex items-center gap-2">
                    <span className={editIsActive ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                      {editIsActive ? "Active" : "Paused"}
                    </span>
                    <Switch
                      checked={editIsActive}
                      onCheckedChange={setEditIsActive}
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer text-xs font-medium pt-1 border-t border-border/40">
                  <div>
                    <span className="font-semibold block">Flagship / Default Hub</span>
                    <span className="text-[10px] text-muted-foreground">Default store for visitors outside geofence</span>
                  </div>
                  <Switch
                    checked={editIsDefault}
                    onCheckedChange={setEditIsDefault}
                  />
                </label>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-border/60 shrink-0 bg-background/95 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingBranch(null)}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingEdit || !editName.trim()}
                className="rounded-xl text-xs font-bold h-9 px-4 shadow-xs"
              >
                {savingEdit ? "Saving..." : "Save Hub Settings"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Confirmation AlertDialog */}
      <AlertDialog open={Boolean(deletingBranch)} onOpenChange={(open) => !open && setDeletingBranch(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-destructive">
              Delete Hub: {deletingBranch?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              {deletingBranch?.is_default ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  This hub is currently configured as the Flagship Dock. You cannot delete the default hub without designating another default branch first.
                </span>
              ) : (
                "Are you sure you want to permanently delete this branch fulfillment hub? This will revoke active sessions and unassign this location from future orders."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
            {!deletingBranch?.is_default && (
              <AlertDialogAction
                className="rounded-xl text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
