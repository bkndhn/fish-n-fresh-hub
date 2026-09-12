import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Key,
  Lock,
  Unlock,
  Server,
  Users,
  Store,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Radio,
  HardDrive,
  Cpu,
  Layers,
  Power,
  Sliders,
  Sparkles,
  Search,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { myRolesQuery } from "@/lib/admin";
import { branchesQuery, type Branch } from "@/lib/multiBranch";
import {
  tenantQuotasQuery,
  platformRevocationsQuery,
  platformAuditLogsQuery,
  superAdminStatsQuery,
  updateTenantQuotas,
  executeKillSwitch,
  checkBranchQuotaAvailable,
  type TenantQuota,
} from "@/lib/superAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/super")({
  head: () => ({
    meta: [
      { title: "Super Admin Governance | Fish N Fresh" },
      { name: "description", content: "Master governance, tenant quotas, emergency kill switch, and anti-takeover control." },
    ],
  }),
  component: SuperAdminDashboard,
});

function SuperAdminDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Role verification
  const { data: myRoles = [], isLoading: rolesLoading } = useQuery(myRolesQuery);
  const isSuperAdmin = myRoles.includes("super_admin") || myRoles.includes("admin");

  // Platform queries
  const { data: stats, isLoading: statsLoading } = useQuery(superAdminStatsQuery);
  const { data: quotas, isLoading: quotasLoading } = useQuery(tenantQuotasQuery);
  const { data: branches = [] } = useQuery(branchesQuery);
  const { data: revocations = [] } = useQuery(platformRevocationsQuery);
  const { data: auditLogs = [] } = useQuery(platformAuditLogsQuery);

  // Quota editor state
  const [maxBranchesInput, setMaxBranchesInput] = useState<number | null>(null);
  const [maxStaffInput, setMaxStaffInput] = useState<number | null>(null);
  const [maxOrdersInput, setMaxOrdersInput] = useState<number | null>(null);
  const [savingQuotas, setSavingQuotas] = useState(false);

  // Emergency Kill Switch modal states
  const [globalKillModalOpen, setGlobalKillModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [killReason, setKillReason] = useState("Security policy enforcement");
  const [executingKill, setExecutingKill] = useState(false);

  // Branch-specific kill switch
  const [targetBranchId, setTargetBranchId] = useState<string>("");

  const effectiveMaxBranches = maxBranchesInput ?? quotas?.max_branches ?? 10;
  const effectiveMaxStaff = maxStaffInput ?? quotas?.max_staff_per_branch ?? 15;
  const effectiveMaxOrders = maxOrdersInput ?? quotas?.max_monthly_orders ?? 25000;

  const quotaCheck = checkBranchQuotaAvailable(
    branches.filter((b) => b.is_active).length,
    quotas?.max_branches ?? 10
  );

  // Save Tenant Quota updates
  const handleSaveQuotas = async () => {
    setSavingQuotas(true);
    try {
      const res = await updateTenantQuotas({
        max_branches: effectiveMaxBranches,
        max_staff_per_branch: effectiveMaxStaff,
        max_monthly_orders: effectiveMaxOrders,
      });

      if (res.success) {
        toast.success("Tenant quotas updated successfully");
        qc.invalidateQueries({ queryKey: ["super-admin"] });
      } else {
        toast.error(res.message || "Failed to update quotas");
      }
    } finally {
      setSavingQuotas(false);
    }
  };

  // Apply Tier Preset
  const handleApplyPreset = async (tier: "starter" | "growth" | "enterprise") => {
    let b = 3;
    let s = 5;
    let o = 5000;
    if (tier === "growth") {
      b = 8;
      s = 15;
      o = 20000;
    } else if (tier === "enterprise") {
      b = 15;
      s = 30;
      o = 100000;
    }

    setMaxBranchesInput(b);
    setMaxStaffInput(s);
    setMaxOrdersInput(o);

    setSavingQuotas(true);
    try {
      await updateTenantQuotas({
        tier,
        max_branches: b,
        max_staff_per_branch: s,
        max_monthly_orders: o,
      });
      toast.success(`Applied ${tier.toUpperCase()} plan preset (${b} hubs limit)`);
      qc.invalidateQueries({ queryKey: ["super-admin"] });
    } finally {
      setSavingQuotas(false);
    }
  };

  // Toggle Tenant Lock / Freeze
  const handleToggleLock = async () => {
    const next = !quotas?.is_locked;
    setSavingQuotas(true);
    try {
      await updateTenantQuotas({ is_locked: next });
      toast.warning(next ? "Tenant locked. Branch and user creation frozen." : "Tenant unlocked.");
      qc.invalidateQueries({ queryKey: ["super-admin"] });
    } finally {
      setSavingQuotas(false);
    }
  };

  // Execute Global Kill Switch
  const handleExecuteGlobalKill = async () => {
    if (confirmText !== "CONFIRM-RESET") {
      toast.error("Please type CONFIRM-RESET to authorize emergency logout.");
      return;
    }

    setExecutingKill(true);
    try {
      const res = await executeKillSwitch("global", null, killReason);
      if (res.success) {
        toast.success("🚨 GLOBAL KILL SWITCH TRIGGERED", {
          description: "Revocation broadcast sent. All active user sessions terminated.",
        });
        setGlobalKillModalOpen(false);
        setConfirmText("");
        qc.invalidateQueries({ queryKey: ["super-admin"] });
      } else {
        toast.error(res.message || "Failed to execute kill switch");
      }
    } finally {
      setExecutingKill(false);
    }
  };

  // Execute Branch Kill Switch
  const handleExecuteBranchKill = async (branchId: string, branchName: string) => {
    if (!confirm(`Force logout all staff and terminal sessions assigned to ${branchName}?`)) return;

    try {
      const res = await executeKillSwitch(
        "branch",
        branchId,
        `Emergency logout for hub: ${branchName}`
      );
      if (res.success) {
        toast.success(`Sessions revoked for ${branchName}`);
        qc.invalidateQueries({ queryKey: ["super-admin"] });
      } else {
        toast.error(res.message || "Failed to revoke branch sessions");
      }
    } catch {
      toast.error("Error executing branch kill switch");
    }
  };

  return (
    <AdminShell title="Super Admin" allow={["admin", "super_admin"]}>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Title & Security Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <ShieldAlert className="size-4.5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground">
                Super Admin Platform Governance
              </h1>
              <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-[10px] uppercase font-bold">
                Tier 0 Clearance
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Master administration: enforce tenant quotas, set $N$ branch limits, execute emergency kill switches, and inspect audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["super-admin"] })}
              className="rounded-xl text-xs gap-1.5 h-8"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>

            <Button
              variant={quotas?.is_locked ? "default" : "outline"}
              size="sm"
              onClick={handleToggleLock}
              disabled={savingQuotas}
              className={`rounded-xl text-xs gap-1.5 h-8 ${
                quotas?.is_locked ? "bg-red-600 hover:bg-red-700 text-white" : "border-amber-500/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              {quotas?.is_locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              {quotas?.is_locked ? "Tenant Frozen" : "Freeze Tenant"}
            </Button>
          </div>
        </div>

        {/* Top KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border-border bg-card/60 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between">
                <span>Active Hubs vs Quota</span>
                <Store className="size-3.5 text-primary" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                {stats?.activeBranchesCount ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  / {stats?.maxBranchesQuota ?? 10} allowed
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (stats?.branchQuotaUtilizationPct ?? 0) >= 90
                      ? "bg-destructive"
                      : "bg-primary"
                  }`}
                  style={{ width: `${stats?.branchQuotaUtilizationPct ?? 10}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {stats?.branchQuotaUtilizationPct ?? 0}% quota consumed
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/60 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between">
                <span>Staff Seats Quota</span>
                <Users className="size-3.5 text-emerald-600" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                {stats?.totalStaffCount ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  / {stats?.maxStaffQuota ?? 15} capacity
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-[10px] text-muted-foreground mt-2.5">
                Max {quotas?.max_staff_per_branch ?? 15} seats per active hub
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/60 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between">
                <span>Monthly Orders Volume</span>
                <Activity className="size-3.5 text-sky-600" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                {stats?.totalOrdersThisMonth ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  / {(stats?.maxMonthlyOrdersQuota ?? 25000).toLocaleString()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all"
                  style={{ width: `${Math.max(5, stats?.ordersQuotaUtilizationPct ?? 0)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Current billing cycle quota
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/60 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between">
                <span>Kill Switch Status</span>
                <Power className="size-3.5 text-red-600" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display text-red-600 dark:text-red-400">
                {stats?.activeKillSwitchesCount ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  revocations (24h)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Anti-takeover shield active</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Tenant Quotas & Limits Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 rounded-2xl border-border bg-card shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="size-4.5 text-primary" />
                  <CardTitle className="text-base font-bold">Tenant Limits &amp; Quota Controls</CardTitle>
                </div>
                <Badge variant="outline" className="capitalize text-[11px] border-primary/30 text-primary">
                  {quotas?.tier || "Enterprise"} Plan
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Configure platform limits for branch provisioning, team seat quotas, and order caps.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Plan Presets */}
              <div className="flex items-center gap-2 flex-wrap pb-2 border-b">
                <span className="text-xs text-muted-foreground font-semibold">Tier Presets:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyPreset("starter")}
                  className="rounded-xl text-[11px] h-7 px-2.5"
                >
                  Starter (3 Hubs)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyPreset("growth")}
                  className="rounded-xl text-[11px] h-7 px-2.5"
                >
                  Growth (8 Hubs)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyPreset("enterprise")}
                  className="rounded-xl text-[11px] h-7 px-2.5 border-primary/40 bg-primary/5 text-primary font-bold"
                >
                  Enterprise (15 Hubs)
                </Button>
              </div>

              {/* Sliders / Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Branch Limit ($N$)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={effectiveMaxBranches}
                    onChange={(e) => setMaxBranchesInput(parseInt(e.target.value) || 1)}
                    className="rounded-xl text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Max allowed physical / dark store hubs</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Staff Seats Per Hub
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={effectiveMaxStaff}
                    onChange={(e) => setMaxStaffInput(parseInt(e.target.value) || 1)}
                    className="rounded-xl text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Max team members per branch</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Monthly Orders Cap
                  </Label>
                  <Input
                    type="number"
                    min={500}
                    step={1000}
                    value={effectiveMaxOrders}
                    onChange={(e) => setMaxOrdersInput(parseInt(e.target.value) || 1000)}
                    className="rounded-xl text-xs font-mono font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Monthly transaction ceiling</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveQuotas}
                  disabled={savingQuotas}
                  className="rounded-xl text-xs font-bold px-4 h-9 shadow-2xs"
                >
                  {savingQuotas ? "Saving Quotas..." : "Save Quota Limits"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Kill Switch Command Card */}
          <Card className="rounded-2xl border-red-500/30 bg-red-500/5 dark:bg-red-950/15 shadow-2xs">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Power className="size-4.5" />
                <CardTitle className="text-base font-bold">Emergency Session Kill Switch</CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Instantly revoke authentication tokens across devices in case of security breaches or compromised staff.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-1">
              {/* 1-Click Global Force Logout */}
              <Button
                variant="destructive"
                onClick={() => setGlobalKillModalOpen(true)}
                className="w-full rounded-xl text-xs font-bold gap-1.5 h-9 bg-red-600 hover:bg-red-700 shadow-xs"
              >
                <Power className="size-3.5" /> Global Emergency Force Logout
              </Button>

              <div className="pt-2 border-t border-red-500/20 space-y-2">
                <Label className="text-xs font-bold text-foreground">
                  Per-Branch Session Kill Switch
                </Label>
                <div className="flex gap-1.5">
                  <select
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    className="h-8 rounded-xl border border-input bg-card px-2 text-xs flex-1"
                  >
                    <option value="">Select a Hub to logout...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!targetBranchId}
                    onClick={() => {
                      const matched = branches.find((b) => b.id === targetBranchId);
                      if (matched) handleExecuteBranchKill(matched.id, matched.name);
                    }}
                    className="rounded-xl text-xs border-red-500/40 text-red-600 hover:bg-red-500/10 h-8"
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Client Branch Quotas & Usage Monitor */}
        <Card className="rounded-2xl border-border bg-card shadow-2xs">
          <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Store className="size-4.5 text-primary" />
                <CardTitle className="text-base font-bold">Client Branch Quotas &amp; Usage Monitor</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    quotaCheck.allowed
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]"
                      : "border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
                  }
                >
                  {branches.filter((b) => b.is_active).length} / {quotas?.max_branches ?? 10} Hubs in Use
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Master platform governance monitor. Displays client-created store branches against the configured $N$ quota limit.
              </CardDescription>
            </div>

            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5 py-1 px-2.5">
              Client Self-Service Active
            </Badge>
          </CardHeader>

          <CardContent>
            {/* Operational Data & Activity Isolation Callout */}
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-foreground">Tenant Operational Isolation Active</span>
                <p className="text-muted-foreground leading-relaxed">
                  Super Admin strictly governs client quota limits ($N$ branch limit, staff seats, monthly transaction caps, and tenant freeze). Branch creation, store catalog, inventory, and fulfillment operations are self-managed exclusively by the Client Admin in Store Settings.
                </p>
              </div>
            </div>

            {!quotaCheck.allowed && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Branch Quota Ceiling Reached:</span> Client has reached the maximum allowed branches ({quotas?.max_branches}). Increase the quota limit above if client requires additional hub headroom.
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
                  <tr>
                    <th className="p-3">Store Hub</th>
                    <th className="p-3">Code / Slug</th>
                    <th className="p-3">Delivery Zone</th>
                    <th className="p-3">Hours</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Operational Ownership</th>
                    <th className="p-3 text-right">Emergency Action</th>
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
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{branch.address || "Tamil Nadu, India"}</p>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <span className="font-bold">{branch.code}</span>
                        <span className="text-muted-foreground block text-[10px]">/{branch.slug}</span>
                      </td>
                      <td className="p-3">{branch.delivery_radius_km} km SLA</td>
                      <td className="p-3 text-muted-foreground">
                        {branch.open_time} – {branch.close_time}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            branch.is_active
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-muted text-muted-foreground"
                          }`}
                        >
                          {branch.is_active ? "Active" : "Paused"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="border-muted bg-muted/40 text-muted-foreground text-[10px]">
                          Client Admin Managed
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExecuteBranchKill(branch.id, branch.name)}
                          className="h-7 text-[11px] text-red-600 hover:bg-red-500/10 rounded-lg font-medium px-2"
                          title="Emergency Force Logout Sessions for this Hub"
                        >
                          Revoke Sessions
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Row 4: Security Audit & Anti-Impersonation Log */}
        <Card className="rounded-2xl border-border bg-card shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4.5 text-emerald-600" />
              <CardTitle className="text-base font-bold">Security Audit &amp; Governance Trail</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Live tamper-evident log of administrative operations, quota modifications, and security revocations.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                No recent security incidents or governance changes logged.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {auditLogs.slice(0, 15).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border p-2.5 text-xs flex items-center justify-between gap-3 bg-muted/20"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono font-bold">
                        <Badge
                          variant="outline"
                          className={
                            log.action.includes("KILL") || log.action.includes("BLOCKED")
                              ? "border-red-500/40 bg-red-500/10 text-red-600 text-[10px]"
                              : "border-primary/40 bg-primary/10 text-primary text-[10px]"
                          }
                        >
                          {log.action}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground truncate">
                          Target: {log.target_type} ({log.target_id || "global"})
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {log.details ? JSON.stringify(log.details) : "No details"}
                      </p>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Global Kill Switch Confirmation Alert Dialog */}
      <AlertDialog open={globalKillModalOpen} onOpenChange={setGlobalKillModalOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto size-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mb-1">
              <ShieldAlert className="size-6" />
            </div>
            <AlertDialogTitle className="text-center text-lg text-destructive font-black">
              EXECUTE GLOBAL KILL SWITCH?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-center leading-relaxed">
              This will <span className="font-bold text-foreground">instantly revoke ALL sessions</span> for every customer, cashier, cutter, driver, and manager across all branches. All active browsers will be force-logged out immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-bold text-foreground">Revocation Reason</Label>
              <Input
                value={killReason}
                onChange={(e) => setKillReason(e.target.value)}
                className="mt-1 rounded-xl text-xs"
                placeholder="e.g. Critical security rotation or suspected intrusion"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-destructive">
                Type <span className="font-mono bg-destructive/10 px-1 rounded">CONFIRM-RESET</span> to proceed:
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 rounded-xl text-xs font-mono font-bold"
                placeholder="CONFIRM-RESET"
              />
            </div>
          </div>

          <AlertDialogFooter className="grid grid-cols-2 gap-2 mt-2">
            <AlertDialogCancel
              onClick={() => {
                setGlobalKillModalOpen(false);
                setConfirmText("");
              }}
              className="rounded-xl text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteGlobalKill}
              disabled={confirmText !== "CONFIRM-RESET" || executingKill}
              className="rounded-xl text-xs bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {executingKill ? "Executing..." : "🚨 WIPE ALL SESSIONS"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit and Delete operations are self-managed exclusively by Client Admins in Store Settings */}
    </AdminShell>
  );
}
