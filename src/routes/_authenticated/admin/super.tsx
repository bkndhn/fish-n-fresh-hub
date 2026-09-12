import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
  Building2,
  Globe,
  Mail,
  Phone,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  ChevronRight,
  Filter,
  UserCheck,
  Clock,
  ShieldX,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { myRolesQuery } from "@/lib/admin";
import {
  platformClientsQuery,
  platformAuditLogsQuery,
  platformRevocationsQuery,
  onboardNewClient,
  toggleClientStatus,
  updateClientQuotas,
  forceLogoutClient,
  executeKillSwitch,
  type PlatformClient,
  type OnboardClientInput,
} from "@/lib/superAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/super")({
  head: () => ({
    meta: [
      { title: "Super Admin Platform Governance | Fish N Fresh" },
      { name: "description", content: "Master platform client management, multi-client onboarding, quota enforcement, and emergency kill switch." },
    ],
  }),
  component: SuperAdminDashboard,
});

const VERTICAL_LABELS: Record<string, { label: string; color: string }> = {
  seafood: { label: "Coastal Seafood & Fish", color: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  chicken_meat: { label: "Poultry & Halal Mutton", color: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  all_meat: { label: "Multi-Meat Superstore", color: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  organic_veggies: { label: "Organic Produce & Greens", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  custom: { label: "Custom Vertical", color: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300" },
};

function SuperAdminDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Role verification - strictly super_admin
  const { data: myRoles = [] } = useQuery(myRolesQuery);
  const isSuperAdmin = myRoles.includes("super_admin");

  // Platform queries
  const { data: clients = [], isLoading: clientsLoading } = useQuery(platformClientsQuery);
  const { data: auditLogs = [] } = useQuery(platformAuditLogsQuery);
  const { data: revocations = [] } = useQuery(platformRevocationsQuery);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"active" | "inactive" | "audit">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [verticalFilter, setVerticalFilter] = useState<string>("all");

  // Onboarding Modal State
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState<OnboardClientInput>({
    client_name: "",
    tenant_code: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    vertical: "seafood",
    domain: "",
    tier: "growth",
    max_branches: 8,
    max_staff_per_branch: 15,
    max_monthly_orders: 20000,
    onboarding_notes: "",
  });
  const [submittingOnboard, setSubmittingOnboard] = useState(false);

  // Handover Credentials Modal
  const [handoverModal, setHandoverModal] = useState<{
    open: boolean;
    credentials?: {
      adminEmail: string;
      tempPassword: string;
      loginUrl: string;
      tenantCode: string;
    };
    clientName?: string;
  }>({ open: false });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Client-Level Force Logout State
  const [killClientModal, setKillClientModal] = useState<{
    open: boolean;
    client: PlatformClient | null;
  }>({ open: false, client: null });
  const [killReason, setKillReason] = useState("Administrative client session revocation");
  const [killConfirmText, setKillConfirmText] = useState("");
  const [executingClientKill, setExecutingClientKill] = useState(false);

  // Global Kill Switch Modal State
  const [globalKillModalOpen, setGlobalKillModalOpen] = useState(false);
  const [globalConfirmText, setGlobalConfirmText] = useState("");
  const [globalKillReason, setGlobalKillReason] = useState("Platform emergency maintenance");
  const [executingGlobalKill, setExecutingGlobalKill] = useState(false);

  // Quotas Edit Modal State
  const [quotaModal, setQuotaModal] = useState<{
    open: boolean;
    client: PlatformClient | null;
  }>({ open: false, client: null });
  const [quotaInputs, setQuotaInputs] = useState<{
    max_branches: number;
    max_staff_per_branch: number;
    max_monthly_orders: number;
    tier: "starter" | "growth" | "enterprise" | "custom";
  }>({
    max_branches: 8,
    max_staff_per_branch: 15,
    max_monthly_orders: 20000,
    tier: "growth",
  });
  const [savingQuotas, setSavingQuotas] = useState(false);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Rollup KPI stats across all clients
  const stats = useMemo(() => {
    const activeClients = clients.filter((c) => c.is_active);
    const inactiveClients = clients.filter((c) => !c.is_active);
    const totalHubs = clients.reduce((sum, c) => sum + c.active_branches_count, 0);
    const totalStaff = clients.reduce((sum, c) => sum + c.total_staff_count, 0);
    const totalMonthlyOrders = clients.reduce((sum, c) => sum + c.monthly_orders_count, 0);

    return {
      totalClients: clients.length,
      activeClientsCount: activeClients.length,
      inactiveClientsCount: inactiveClients.length,
      totalHubs,
      totalStaff,
      totalMonthlyOrders,
    };
  }, [clients]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Tab matching
      if (activeTab === "active" && !c.is_active) return false;
      if (activeTab === "inactive" && c.is_active) return false;

      // Vertical matching
      if (verticalFilter !== "all" && c.vertical !== verticalFilter) return false;

      // Search matching
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.client_name.toLowerCase().includes(q) ||
        c.tenant_code.toLowerCase().includes(q) ||
        c.owner_name.toLowerCase().includes(q) ||
        c.owner_email.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q)
      );
    });
  }, [clients, activeTab, verticalFilter, searchQuery]);

  // Handle Onboard New Client
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.client_name.trim() || !onboardForm.owner_email.trim()) {
      toast.error("Client Name and Owner Email are required.");
      return;
    }

    setSubmittingOnboard(true);
    try {
      const res = await onboardNewClient(onboardForm);
      if (res.success && res.client && res.credentials) {
        toast.success(res.message);
        setOnboardModalOpen(false);
        setHandoverModal({
          open: true,
          credentials: res.credentials,
          clientName: res.client.client_name,
        });
        qc.invalidateQueries({ queryKey: ["super-admin", "clients-fleet"] });
      } else {
        toast.error(res.message || "Failed to onboard client.");
      }
    } finally {
      setSubmittingOnboard(false);
    }
  };

  // Handle Client Status Toggle (Activate / Suspend)
  const handleToggleClient = async (client: PlatformClient) => {
    const nextState = !client.is_active;
    const confirmMsg = nextState
      ? `Re-activate client "${client.client_name}"? All branch operations will resume.`
      : `⚠️ SUSPEND CLIENT "${client.client_name}"?\n\nThis will immediately freeze client access and force logout all branch terminals, staff, and customers.`;

    if (!window.confirm(confirmMsg)) return;

    const res = await toggleClientStatus(client.id, nextState);
    if (res.success) {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["super-admin", "clients-fleet"] });
    } else {
      toast.error(res.message);
    }
  };

  // Open Quotas Edit Modal
  const handleOpenQuotaModal = (client: PlatformClient) => {
    setQuotaModal({ open: true, client });
    setQuotaInputs({
      max_branches: client.max_branches,
      max_staff_per_branch: client.max_staff_per_branch,
      max_monthly_orders: client.max_monthly_orders,
      tier: client.tier,
    });
  };

  // Save Quotas
  const handleSaveQuotas = async () => {
    if (!quotaModal.client) return;
    setSavingQuotas(true);
    try {
      const res = await updateClientQuotas(quotaModal.client.id, quotaInputs);
      if (res.success) {
        toast.success(res.message);
        setQuotaModal({ open: false, client: null });
        qc.invalidateQueries({ queryKey: ["super-admin", "clients-fleet"] });
      } else {
        toast.error(res.message);
      }
    } finally {
      setSavingQuotas(false);
    }
  };

  // Execute Client-Level Force Logout
  const handleExecuteClientKill = async () => {
    if (killConfirmText !== "LOGOUT") {
      toast.error("Type LOGOUT to confirm emergency client revocation.");
      return;
    }
    if (!killClientModal.client) return;

    setExecutingClientKill(true);
    try {
      const res = await forceLogoutClient(
        killClientModal.client.id,
        killClientModal.client.client_name,
        killClientModal.client.tenant_code,
        killReason
      );

      if (res.success) {
        toast.success(`🚨 ${res.message}`);
        setKillClientModal({ open: false, client: null });
        setKillConfirmText("");
        qc.invalidateQueries({ queryKey: ["super-admin", "clients-fleet"] });
      } else {
        toast.error(res.message);
      }
    } finally {
      setExecutingClientKill(false);
    }
  };

  // Execute Platform-Wide Global Kill Switch
  const handleExecuteGlobalKill = async () => {
    if (globalConfirmText !== "CONFIRM-RESET") {
      toast.error("Type CONFIRM-RESET to authorize emergency platform logout.");
      return;
    }

    setExecutingGlobalKill(true);
    try {
      const res = await executeKillSwitch("global", null, globalKillReason);
      if (res.success) {
        toast.success("🚨 PLATFORM GLOBAL KILL SWITCH TRIGGERED", {
          description: "All sessions across all clients terminated immediately.",
        });
        setGlobalKillModalOpen(false);
        setGlobalConfirmText("");
        qc.invalidateQueries({ queryKey: ["super-admin"] });
      } else {
        toast.error(res.message || "Failed to trigger global kill switch.");
      }
    } finally {
      setExecutingGlobalKill(false);
    }
  };

  return (
    <AdminShell title="Super Admin Platform Governance" allow={["super_admin"]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Header Title & Platform Operations Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="flex size-8 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                <ShieldAlert className="size-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground">
                Super Admin Platform Governance
              </h1>
              <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-[10px] uppercase font-bold shrink-0">
                Tier 0 Platform Clearance
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Master organization governance: manage active/inactive clients, provision new white-label tenants, enforce quota ceilings, and trigger client force logouts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["super-admin"] })}
              className="rounded-xl text-xs gap-1.5 h-8.5"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setOnboardForm({
                  client_name: "",
                  tenant_code: "",
                  owner_name: "",
                  owner_email: "",
                  owner_phone: "",
                  vertical: "seafood",
                  domain: "",
                  tier: "growth",
                  max_branches: 8,
                  max_staff_per_branch: 15,
                  max_monthly_orders: 20000,
                  onboarding_notes: "",
                });
                setOnboardModalOpen(true);
              }}
              className="rounded-xl text-xs font-bold gap-1.5 h-8.5 bg-primary hover:bg-primary/90 shadow-2xs"
            >
              <Plus className="size-3.5" /> Onboard New Client
            </Button>
          </div>
        </div>

        {/* Top Rollup Platform KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border-border bg-card/70 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between text-muted-foreground">
                <span>Active Clients</span>
                <Building2 className="size-3.5 text-primary" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                {stats.activeClientsCount}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  / {stats.totalClients} total clients
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {stats.activeClientsCount} live organizations operational
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/70 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between text-muted-foreground">
                <span>Total Active Hubs</span>
                <Store className="size-3.5 text-emerald-600" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                {stats.totalHubs}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  store branches
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-[10px] text-muted-foreground mt-1">
                Distributed across {stats.activeClientsCount} client fleets
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/70 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between text-muted-foreground">
                <span>Platform Staff Seats</span>
                <Users className="size-3.5 text-sky-600" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                {stats.totalStaff}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  authorized team members
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-[10px] text-muted-foreground mt-1">
                Store admins, cashiers, &amp; drivers
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card/70 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-4">
              <CardDescription className="text-[11px] font-semibold flex items-center justify-between text-muted-foreground">
                <span>Monthly Orders Volume</span>
                <Activity className="size-3.5 text-purple-600" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold font-display">
                {stats.totalMonthlyOrders.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  orders (current cycle)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <p className="text-[10px] text-muted-foreground mt-1">
                Platform aggregate transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Emergency Kill Switch Banner */}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600 shrink-0 mt-0.5">
              <Power className="size-4.5" />
            </span>
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-foreground">Global Platform Emergency Reset</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Revoke all active sessions platform-wide across all clients in the event of severe security incidents or maintenance. For individual clients, use the <strong>Force Logout Client</strong> action on the respective client card below.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setGlobalKillModalOpen(true)}
            className="rounded-xl text-xs font-bold shrink-0 bg-red-600 hover:bg-red-700 h-8.5"
          >
            <Power className="size-3.5 mr-1.5" /> Platform Global Kill Switch
          </Button>
        </div>

        {/* Client Fleet Management Tabs & Filters */}
        <Card className="rounded-2xl border-border bg-card shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/80 bg-muted/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as "active" | "inactive" | "audit")}
                className="w-full md:w-auto"
              >
                <TabsList className="grid grid-cols-3 w-full md:w-[420px] rounded-xl">
                  <TabsTrigger value="active" className="text-xs font-bold rounded-lg gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Active Clients ({stats.activeClientsCount})
                  </TabsTrigger>
                  <TabsTrigger value="inactive" className="text-xs font-bold rounded-lg gap-1.5">
                    <ShieldX className="size-3.5 text-amber-500" />
                    Inactive ({stats.inactiveClientsCount})
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="text-xs font-bold rounded-lg gap-1.5">
                    <Clock className="size-3.5 text-sky-500" />
                    Audit Logs
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Search & Vertical Filter */}
              {activeTab !== "audit" && (
                <div className="flex items-center gap-2 flex-1 md:max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by client name, code, domain, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8.5 rounded-xl text-xs"
                    />
                  </div>

                  <select
                    value={verticalFilter}
                    onChange={(e) => setVerticalFilter(e.target.value)}
                    className="h-8.5 rounded-xl border border-input bg-card px-2.5 text-xs text-foreground font-medium"
                  >
                    <option value="all">All Verticals</option>
                    <option value="seafood">Seafood &amp; Fish</option>
                    <option value="chicken_meat">Poultry &amp; Halal</option>
                    <option value="all_meat">Multi-Meat Superstore</option>
                    <option value="organic_veggies">Organic Produce</option>
                  </select>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Audit Logs Tab View */}
            {activeTab === "audit" ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                  <span className="font-semibold text-foreground">Immutable Platform Audit Trail</span>
                  <span>Showing recent {auditLogs.length} events</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
                      <tr>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Actor</th>
                        <th className="p-3">Target</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30">
                          <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold">
                              {log.action}
                            </Badge>
                          </td>
                          <td className="p-3 font-medium text-foreground">{log.actor_role}</td>
                          <td className="p-3 text-muted-foreground">{log.target_type || "—"}</td>
                          <td className="p-3 font-mono text-[10px] text-muted-foreground max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            No audit log events recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Active / Inactive Clients List */
              <div className="divide-y divide-border">
                {filteredClients.map((client) => {
                  const verticalInfo = VERTICAL_LABELS[client.vertical] || VERTICAL_LABELS.custom;
                  const hubsUtilizationPct = Math.round((client.active_branches_count / client.max_branches) * 100);

                  return (
                    <div
                      key={client.id}
                      className="p-4 sm:p-5 hover:bg-muted/10 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Left Block: Client Info & Vertical */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base text-foreground font-display">
                            {client.client_name}
                          </h3>
                          <Badge variant="outline" className="font-mono text-[11px] font-bold">
                            {client.tenant_code}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${verticalInfo.color}`}>
                            {verticalInfo.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              client.is_active
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]"
                                : "border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
                            }
                          >
                            {client.is_active ? "Active" : "Suspended"}
                          </Badge>
                          <Badge variant="outline" className="capitalize text-[10px] border-primary/30 text-primary font-bold">
                            {client.tier} Plan
                          </Badge>
                        </div>

                        {/* Owner Details & Contact */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <UserCheck className="size-3.5 text-foreground" />
                            <strong>Owner:</strong> {client.owner_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="size-3.5" />
                            {client.owner_email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="size-3.5" />
                            {client.owner_phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Globe className="size-3.5 text-sky-500" />
                            {client.domain}
                          </span>
                        </div>

                        {client.onboarding_notes && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 inline-block">
                            📌 <strong>Note:</strong> {client.onboarding_notes}
                          </p>
                        )}
                      </div>

                      {/* Middle Block: Live Quotas & Utilization */}
                      <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:w-[360px] bg-muted/30 p-3 rounded-2xl border border-border/60 shrink-0">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Hubs</p>
                          <p className="text-sm font-bold font-mono text-foreground">
                            {client.active_branches_count}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">/ {client.max_branches}</span>
                          </p>
                          <div className="w-full bg-muted rounded-full h-1 mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${hubsUtilizationPct >= 100 ? "bg-destructive" : "bg-primary"}`}
                              style={{ width: `${Math.min(100, hubsUtilizationPct)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Staff Seats</p>
                          <p className="text-sm font-bold font-mono text-foreground">
                            {client.total_staff_count}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">
                              / {client.max_staff_per_branch * Math.max(1, client.active_branches_count)}
                            </span>
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-1">
                            max {client.max_staff_per_branch}/hub
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Orders/Mo</p>
                          <p className="text-sm font-bold font-mono text-foreground">
                            {client.monthly_orders_count.toLocaleString()}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">
                              / {client.max_monthly_orders >= 1000 ? `${client.max_monthly_orders / 1000}k` : client.max_monthly_orders}
                            </span>
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-1 truncate">
                            Active billing
                          </p>
                        </div>
                      </div>

                      {/* Right Block: Actions */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenQuotaModal(client)}
                          className="rounded-xl text-xs h-8 gap-1"
                        >
                          <Sliders className="size-3" /> Limits
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleClient(client)}
                          className={`rounded-xl text-xs h-8 gap-1 ${
                            client.is_active
                              ? "text-amber-700 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              : "text-emerald-700 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          }`}
                        >
                          {client.is_active ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                          {client.is_active ? "Suspend" : "Activate"}
                        </Button>

                        {/* Direct Client-Level Force Logout (Kill Switch) */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setKillClientModal({ open: true, client });
                            setKillConfirmText("");
                            setKillReason("Administrative client session reset");
                          }}
                          className="rounded-xl text-xs h-8 gap-1 border-red-500/30 text-red-600 hover:bg-red-500/10"
                        >
                          <Power className="size-3" /> Force Logout Client
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {filteredClients.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">No {activeTab} clients found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchQuery ? "Try clearing your search criteria or vertical filter." : 'Click "+ Onboard New Client" above to provision the first client.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guided Client Onboarding Modal */}
        <Dialog open={onboardModalOpen} onOpenChange={setOnboardModalOpen}>
          <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-4.5" />
                </span>
                <div>
                  <DialogTitle className="text-lg font-bold">Onboard New Client Organization</DialogTitle>
                  <DialogDescription className="text-xs">
                    Provision a complete multi-client tenant with business profile, vertical preset, quota limits, and initial admin credentials.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleOnboardSubmit} className="space-y-4 pt-2">
              {/* Step 1: Business Profile */}
              <div className="space-y-3 border-b pb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Business Profile</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Business / Client Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Coastal Catch Seafoods"
                      value={onboardForm.client_name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const code = name.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 10).toUpperCase();
                        setOnboardForm({
                          ...onboardForm,
                          client_name: name,
                          tenant_code: onboardForm.tenant_code ? onboardForm.tenant_code : code,
                          domain: onboardForm.domain ? onboardForm.domain : `${code.toLowerCase()}.fishnfresh.in`,
                        });
                      }}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tenant Code (Slug) *</Label>
                    <Input
                      required
                      placeholder="e.g. COASTAL-CAT"
                      value={onboardForm.tenant_code}
                      onChange={(e) => setOnboardForm({ ...onboardForm, tenant_code: e.target.value.toUpperCase() })}
                      className="rounded-xl text-xs font-mono font-bold uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Business Vertical Preset</Label>
                    <select
                      value={onboardForm.vertical}
                      onChange={(e) => setOnboardForm({ ...onboardForm, vertical: e.target.value as any })}
                      className="w-full h-9 rounded-xl border border-input bg-card px-2.5 text-xs text-foreground font-medium"
                    >
                      <option value="seafood">Coastal Seafood &amp; Fresh Fish Chain</option>
                      <option value="chicken_meat">Farm Chicken &amp; Halal Mutton</option>
                      <option value="all_meat">Multi-Meat &amp; Protein Superstore</option>
                      <option value="organic_veggies">Organic Vegetables &amp; Greens</option>
                      <option value="custom">Custom Specialty Retail</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Primary Store Domain</Label>
                    <Input
                      placeholder="e.g. coastalcatch.in"
                      value={onboardForm.domain}
                      onChange={(e) => setOnboardForm({ ...onboardForm, domain: e.target.value })}
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Owner & Admin Credentials */}
              <div className="space-y-3 border-b pb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Client Owner &amp; Admin Credentials</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Owner Full Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Rajesh Kumar"
                      value={onboardForm.owner_name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, owner_name: e.target.value })}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Owner Admin Email *</Label>
                    <Input
                      required
                      type="email"
                      placeholder="owner@clientdomain.com"
                      value={onboardForm.owner_email}
                      onChange={(e) => setOnboardForm({ ...onboardForm, owner_email: e.target.value })}
                      className="rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Primary Phone *</Label>
                    <Input
                      required
                      placeholder="+91 98400 12345"
                      value={onboardForm.owner_phone}
                      onChange={(e) => setOnboardForm({ ...onboardForm, owner_phone: e.target.value })}
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Plan Tier & Quota Limits */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Subscription Tier &amp; Quotas</h4>
                <div className="flex gap-2 pb-1">
                  {(["starter", "growth", "enterprise"] as const).map((tier) => (
                    <Button
                      key={tier}
                      type="button"
                      size="sm"
                      variant={onboardForm.tier === tier ? "default" : "outline"}
                      onClick={() => {
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
                        setOnboardForm({
                          ...onboardForm,
                          tier,
                          max_branches: b,
                          max_staff_per_branch: s,
                          max_monthly_orders: o,
                        });
                      }}
                      className="rounded-xl text-xs capitalize flex-1 h-8 font-semibold"
                    >
                      {tier}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Max Hubs ($N$)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={onboardForm.max_branches}
                      onChange={(e) => setOnboardForm({ ...onboardForm, max_branches: Number(e.target.value) })}
                      className="rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Staff Seats/Hub</Label>
                    <Input
                      type="number"
                      min={1}
                      value={onboardForm.max_staff_per_branch}
                      onChange={(e) => setOnboardForm({ ...onboardForm, max_staff_per_branch: Number(e.target.value) })}
                      className="rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Monthly Orders Cap</Label>
                    <Input
                      type="number"
                      min={500}
                      step={1000}
                      value={onboardForm.max_monthly_orders}
                      onChange={(e) => setOnboardForm({ ...onboardForm, max_monthly_orders: Number(e.target.value) })}
                      className="rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold">Onboarding Notes / KYC Remarks</Label>
                  <Textarea
                    placeholder="Optional onboarding notes, GSTIN, FSSAI verification details..."
                    value={onboardForm.onboarding_notes}
                    onChange={(e) => setOnboardForm({ ...onboardForm, onboarding_notes: e.target.value })}
                    rows={2}
                    className="rounded-xl text-xs resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOnboardModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingOnboard}
                  className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90"
                >
                  {submittingOnboard ? "Provisioning Client..." : "Complete Client Onboarding"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Client Handover Kit Modal (Credentials & Setup Instructions) */}
        <Dialog open={handoverModal.open} onOpenChange={(open) => setHandoverModal({ ...handoverModal, open })}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <DialogTitle className="text-lg font-bold">Client Handover Kit</DialogTitle>
                  <DialogDescription className="text-xs">
                    Client provisioned! Share these credentials with the client owner to access their store console.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {handoverModal.credentials && (
              <div className="space-y-3 pt-2">
                <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-sans text-[11px]">Organization:</span>
                    <strong className="text-foreground font-sans">{handoverModal.clientName}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-sans text-[11px]">Tenant Code:</span>
                    <strong className="text-foreground">{handoverModal.credentials.tenantCode}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-sans text-[11px]">Admin Login Email:</span>
                    <strong className="text-foreground">{handoverModal.credentials.adminEmail}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-sans text-[11px]">Temporary Password:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {handoverModal.credentials.tempPassword}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <span className="text-muted-foreground font-sans text-[11px]">Console URL:</span>
                    <a
                      href={handoverModal.credentials.loginUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-sans text-xs"
                    >
                      Open Login <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    const c = handoverModal.credentials!;
                    const handoverText = `🎉 Welcome to your new store platform on Fish N Fresh Multi-Tenant Engine!\n\n🏢 Client Organization: ${handoverModal.clientName}\n🔑 Tenant Code: ${c.tenantCode}\n📧 Admin Login: ${c.adminEmail}\n🔐 Temp Password: ${c.tempPassword}\n🌐 Console Login Link: ${c.loginUrl}\n\nPlease sign in and update your password in Settings.`;
                    handleCopy(handoverText, "handover");
                  }}
                  className="w-full rounded-xl text-xs font-bold gap-1.5 h-9"
                >
                  {copiedKey === "handover" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedKey === "handover" ? "Handover Kit Copied!" : "Copy Full Handover Kit"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Client-Level Force Logout (Kill Switch) Modal */}
        <Dialog open={killClientModal.open} onOpenChange={(open) => setKillClientModal({ ...killClientModal, open })}>
          <DialogContent className="max-w-md rounded-3xl p-6 border-red-500/30">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600">
                <span className="flex size-8 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                  <Power className="size-4.5" />
                </span>
                <div>
                  <DialogTitle className="text-lg font-bold">Client Force Logout</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Emergency session revocation for client organization.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {killClientModal.client && (
              <div className="space-y-3 pt-2 text-xs">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-red-800 dark:text-red-300 leading-relaxed">
                  ⚠️ This action will immediately terminate <strong>ALL active user sessions</strong> across <strong>{killClientModal.client.client_name}</strong> ({killClientModal.client.tenant_code}). All branch cash registers, staff logins, delivery drivers, and logged-in customers for this organization will be forcefully signed out.
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Reason for Client Force Logout</Label>
                  <Input
                    value={killReason}
                    onChange={(e) => setKillReason(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold">Type <strong className="text-red-600">LOGOUT</strong> to authorize</Label>
                  <Input
                    placeholder="LOGOUT"
                    value={killConfirmText}
                    onChange={(e) => setKillConfirmText(e.target.value)}
                    className="rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setKillClientModal({ open: false, client: null })}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={killConfirmText !== "LOGOUT" || executingClientKill}
                    onClick={handleExecuteClientKill}
                    className="rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700"
                  >
                    {executingClientKill ? "Revoking Sessions..." : "Authorize Force Logout"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Global Platform Kill Switch Modal */}
        <Dialog open={globalKillModalOpen} onOpenChange={setGlobalKillModalOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 border-red-600">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600">
                <Power className="size-5" />
                <div>
                  <DialogTitle className="text-lg font-bold">PLATFORM GLOBAL KILL SWITCH</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Highest-clearance emergency platform session revocation.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-900 dark:text-red-200">
                🚨 <strong>CAUTION:</strong> This will terminate all authenticated sessions across <strong>EVERY client organization</strong> on the platform simultaneously.
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Type <strong className="text-red-600">CONFIRM-RESET</strong> to authorize</Label>
                <Input
                  placeholder="CONFIRM-RESET"
                  value={globalConfirmText}
                  onChange={(e) => setGlobalConfirmText(e.target.value)}
                  className="rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setGlobalKillModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={globalConfirmText !== "CONFIRM-RESET" || executingGlobalKill}
                  onClick={handleExecuteGlobalKill}
                  className="rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700"
                >
                  {executingGlobalKill ? "Resetting..." : "TRIGGER GLOBAL KILL SWITCH"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Quota Limits Editor Modal */}
        <Dialog open={quotaModal.open} onOpenChange={(open) => setQuotaModal({ ...quotaModal, open })}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Sliders className="size-4.5 text-primary" />
                <div>
                  <DialogTitle className="text-lg font-bold">Adjust Client Quotas</DialogTitle>
                  <DialogDescription className="text-xs">
                    Configure branch limits ($N$), staff seat caps, and transaction ceilings for {quotaModal.client?.client_name}.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Subscription Tier</Label>
                <select
                  value={quotaInputs.tier}
                  onChange={(e) => setQuotaInputs({ ...quotaInputs, tier: e.target.value as any })}
                  className="w-full h-8.5 rounded-xl border border-input bg-card px-2.5 text-xs text-foreground font-medium"
                >
                  <option value="starter">Starter Plan</option>
                  <option value="growth">Growth Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                  <option value="custom">Custom Enterprise</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Max Hubs ($N$)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quotaInputs.max_branches}
                    onChange={(e) => setQuotaInputs({ ...quotaInputs, max_branches: Number(e.target.value) })}
                    className="rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Staff Seats/Hub</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quotaInputs.max_staff_per_branch}
                    onChange={(e) => setQuotaInputs({ ...quotaInputs, max_staff_per_branch: Number(e.target.value) })}
                    className="rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Monthly Orders</Label>
                  <Input
                    type="number"
                    min={500}
                    step={1000}
                    value={quotaInputs.max_monthly_orders}
                    onChange={(e) => setQuotaInputs({ ...quotaInputs, max_monthly_orders: Number(e.target.value) })}
                    className="rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setQuotaModal({ open: false, client: null })}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  disabled={savingQuotas}
                  onClick={handleSaveQuotas}
                  className="rounded-xl text-xs font-bold"
                >
                  {savingQuotas ? "Saving..." : "Save Quota Changes"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}
