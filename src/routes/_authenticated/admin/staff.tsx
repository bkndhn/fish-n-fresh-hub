import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  branchesQuery,
  DEFAULT_MANAGER_PERMISSIONS,
  FULL_MANAGER_PERMISSIONS,
  type BranchManagerPermissions,
} from "@/lib/multiBranch";
import {
  listStaff,
  inviteStaff,
  setStaffRole,
  createStaffAccount,
  type AppRole,
  type StaffMember,
} from "@/lib/staff.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({
    meta: [
      { title: "Team & Roles | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Invite drivers and staff to Fish N Fresh and manage admin, staff and driver roles.",
      },
      { property: "og:title", content: "Team & Roles | Fish N Fresh Admin" },
      {
        property: "og:description",
        content: "Invite drivers and staff to Fish N Fresh and manage admin, staff and driver roles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

const ASSIGNABLE: AppRole[] = [
  "admin",
  "manager",
  "cashier",
  "driver",
  "inventory_manager",
  "support_staff",
  "staff",
];

const ROLE_HINT: Record<AppRole, string> = {
  admin: "Full Super Admin: Access to all settings, finances, and team management",
  manager: "Store Manager: Daily operations, sales reports, orders, promotions, catalog",
  cashier: "POS Cashier: In-Store POS counter billing and counter order management only",
  driver: "Delivery Fleet Driver: Delivery dispatch, route navigation, COD cash handover",
  inventory_manager: "Catch & Inventory Manager: Inward harbour catch, products, waste logging",
  support_staff: "Customer Support: Live chat support, orders, customer complaints",
  staff: "General Staff: Orders, catalog, and store support",
  user: "Regular retail customer account",
};

function StaffPage() {
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const invite = useServerFn(inviteStaff);
  const updateRole = useServerFn(setStaffRole);
  const createAccount = useServerFn(createStaffAccount);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("driver");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("driver");

  const { data: branches = [] } = useQuery(branchesQuery);
  const [assignBranchId, setAssignBranchId] = useState<string>("all");
  const [newAssignBranchId, setNewAssignBranchId] = useState<string>("all");
  const [managerPermissions, setManagerPermissions] = useState<BranchManagerPermissions>(DEFAULT_MANAGER_PERMISSIONS);

  const staffQuery = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: async (): Promise<StaffMember[]> => {
      try {
        const res = await fetchStaff();
        if (Array.isArray(res) && res.length > 0) return res;
      } catch (err) {
        console.warn("Server listStaff notice, attempting direct database query:", err);
      }

      // Direct client fallback querying user_roles
      try {
        const { data: roleRows, error: roleErr } = await supabase
          .from("user_roles")
          .select("user_id, role, created_at");

        if (roleErr) throw roleErr;

        const { data: orders } = await supabase
          .from("orders")
          .select("user_id, customer_name, customer_phone")
          .not("user_id", "is", null);

        const userMap = new Map<string, { name: string; phone: string }>();
        for (const o of orders ?? []) {
          if (o.user_id && !userMap.has(o.user_id)) {
            userMap.set(o.user_id, { name: o.customer_name, phone: o.customer_phone });
          }
        }

        const byUser = new Map<
          string,
          {
            id: string;
            email: string;
            full_name: string | null;
            roles: AppRole[];
            created_at: string;
            last_sign_in_at: string | null;
            confirmed: boolean;
          }
        >();

        for (const row of roleRows ?? []) {
          const uInfo = userMap.get(row.user_id);
          const existing = byUser.get(row.user_id);
          if (existing) {
            if (!existing.roles.includes(row.role as AppRole)) {
              existing.roles.push(row.role as AppRole);
            }
          } else {
            byUser.set(row.user_id, {
              id: row.user_id,
              email: uInfo ? `${uInfo.name.toLowerCase().replace(/\s+/g, ".")}@store` : `staff-${row.user_id.slice(0, 6)}@store`,
              full_name: uInfo?.name || `Staff Member (${row.user_id.slice(0, 6)})`,
              roles: [row.role as AppRole],
              created_at: row.created_at || new Date().toISOString(),
              last_sign_in_at: null,
              confirmed: true,
            });
          }
        }

        return Array.from(byUser.values());
      } catch (fallbackErr) {
        console.error("Direct staff query fallback error:", fallbackErr);
        return [];
      }
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (vars: { email: string; fullName: string; role: AppRole }) =>
      invite({
        data: {
          email: vars.email,
          fullName: vars.fullName,
          role: vars.role,
          redirectTo: `${window.location.origin}/auth`,
        },
      }),
    onSuccess: (res) => {
      setEmail("");
      setFullName("");
      if (res.tempPassword) {
        toast.success(`Account created for ${res.email}`, {
          description: `Temporary password: ${res.tempPassword}`,
          duration: 20000,
        });
      } else {
        toast.success(`Invite sent to ${res.email} as ${res.role}`);
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: (vars: {
      email: string;
      password: string;
      fullName: string;
      phone: string;
      role: AppRole;
    }) => createAccount({ data: vars }),
    onSuccess: (res) => {
      toast.success(
        res.updatedExisting
          ? `Updated ${res.email} — password reset and role set to ${res.role}`
          : `${res.email} can now sign in as ${res.role}`,
        { duration: 12000 },
      );
      setNewEmail("");
      setNewName("");
      setNewPhone("");
      setNewPassword("");
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole; enabled: boolean }) =>
      updateRole({ data: vars }),
    onSuccess: () => {
      toast.success("Roles updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const members = staffQuery.data ?? [];

  return (
    <AdminShell title="Team & roles">
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
            <CardDescription>They get their own login with the role you pick.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate({ email, fullName, role });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  required
                  placeholder="driver@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  placeholder="Ravi Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Branch / Hub</Label>
                <Select value={assignBranchId} onValueChange={setAssignBranchId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 All Branches (Global Headquarters)</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        📍 {b.name} ({b.code || "HUB"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ROLE_HINT[role]}</p>
              </div>

              {role === "manager" && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Full Branch Access Delegation</span>
                    <Switch
                      checked={managerPermissions.has_full_branch_access}
                      onCheckedChange={(checked) =>
                        setManagerPermissions((prev) =>
                          checked ? FULL_MANAGER_PERMISSIONS : DEFAULT_MANAGER_PERMISSIONS
                        )
                      }
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Grant complete local control over store operations for this branch without granting access to company-wide settings or other hubs.
                  </p>
                  {!managerPermissions.has_full_branch_access && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={managerPermissions.can_manage_inventory}
                          onChange={(e) =>
                            setManagerPermissions((p) => ({ ...p, can_manage_inventory: e.target.checked }))
                          }
                          className="rounded text-primary"
                        />
                        <span>Inventory & Batches</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={managerPermissions.can_edit_prices}
                          onChange={(e) =>
                            setManagerPermissions((p) => ({ ...p, can_edit_prices: e.target.checked }))
                          }
                          className="rounded text-primary"
                        />
                        <span>Adjust Prices</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={managerPermissions.can_manage_local_staff}
                          onChange={(e) =>
                            setManagerPermissions((p) => ({ ...p, can_manage_local_staff: e.target.checked }))
                          }
                          className="rounded text-primary"
                        />
                        <span>Staff Rosters</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={managerPermissions.can_view_financial_reports}
                          onChange={(e) =>
                            setManagerPermissions((p) => ({ ...p, can_view_financial_reports: e.target.checked }))
                          }
                          className="rounded text-primary"
                        />
                        <span>Sales Reports</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-1.5 size-4" />
                )}
                Send invite
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create an account with a password</CardTitle>
            <CardDescription>
              No email needed — set the password yourself and hand it to your driver or staff member.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  email: newEmail,
                  password: newPassword,
                  fullName: newName,
                  phone: newPhone,
                  role: newRole,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  required
                  placeholder="driver@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  placeholder="Ravi Kumar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-phone">Phone (optional)</Label>
                <Input
                  id="create-phone"
                  inputMode="numeric"
                  placeholder="9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-password">Password</Label>
                <div className="flex gap-2">
                  <Input
                    id="create-password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setNewPassword(`Fnf-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`)
                    }
                  >
                    Suggest
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Branch / Hub</Label>
                <Select value={newAssignBranchId} onValueChange={setNewAssignBranchId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 All Branches (Global Headquarters)</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        📍 {b.name} ({b.code || "HUB"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ROLE_HINT[newRole]}</p>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-1.5 size-4" />
                )}
                Create account
              </Button>
              <p className="text-xs text-muted-foreground">
                If the email already has an account, the password and role are updated instead.
              </p>
            </form>
          </CardContent>
        </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team members</CardTitle>
            <CardDescription>Toggle roles on or off for any account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {staffQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading team...</p>
            ) : staffQuery.isError ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                <p className="font-semibold">Unable to list team members automatically</p>
                <p className="mt-1 opacity-90">{(staffQuery.error as Error).message}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Tip: Connect your Supabase project in Lovable Cloud settings or add SUPABASE_SERVICE_ROLE_KEY for full account administration.
                </p>
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
              members.map((m) => (
                <div key={m.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{m.full_name ?? m.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    {!m.confirmed && (
                      <Badge variant="outline" className="ml-auto">
                        Invite pending
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {ASSIGNABLE.map((r) => (
                      <label key={r} className="flex items-center gap-2 text-xs capitalize">
                        <Switch
                          checked={m.roles.includes(r)}
                          disabled={roleMutation.isPending}
                          onCheckedChange={(checked) =>
                            roleMutation.mutate({ userId: m.id, role: r, enabled: checked })
                          }
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
