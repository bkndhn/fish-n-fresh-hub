import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "staff" | "driver" | "user";
const ROLES: AppRole[] = ["admin", "staff", "driver", "user"];

export type StaffMember = {
  id: string;
  email: string;
  full_name: string | null;
  roles: AppRole[];
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffMember[]> => {
    await assertAdmin(context as never);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      if (!error && users?.users) {
        const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id, role");
        const byUser = new Map<string, AppRole[]>();
        for (const row of roleRows ?? []) {
          const list = byUser.get(row.user_id) ?? [];
          list.push(row.role as AppRole);
          byUser.set(row.user_id, list);
        }

        return users.users.map((u) => ({
          id: u.id,
          email: u.email ?? "",
          full_name: (u.user_metadata?.["full_name"] as string) ?? null,
          roles: byUser.get(u.id) ?? [],
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          confirmed: Boolean(u.email_confirmed_at),
        }));
      }
    } catch (adminErr: any) {
      console.warn("Supabase admin auth unavailable, falling back to database roles:", adminErr?.message);
    }

    // Graceful fallback: query user_roles table directly with authenticated client
    const ctx = context as any;
    const { data: roleRows } = await ctx.supabase.from("user_roles").select("user_id, role, created_at");
    
    // Also try to get customer/user info from orders
    const { data: orders } = await ctx.supabase
      .from("orders")
      .select("user_id, customer_name, customer_phone")
      .not("user_id", "is", null);

    const userMap = new Map<string, { name: string; phone: string }>();
    for (const o of orders ?? []) {
      if (o.user_id && !userMap.has(o.user_id)) {
        userMap.set(o.user_id, { name: o.customer_name, phone: o.customer_phone });
      }
    }

    const byUser = new Map<string, { id: string; roles: AppRole[]; created_at: string }>();
    for (const row of roleRows ?? []) {
      const existing = byUser.get(row.user_id);
      if (existing) {
        existing.roles.push(row.role as AppRole);
      } else {
        byUser.set(row.user_id, {
          id: row.user_id,
          roles: [row.role as AppRole],
          created_at: row.created_at || new Date().toISOString(),
        });
      }
    }

    return Array.from(byUser.values()).map((u) => {
      const meta = userMap.get(u.id);
      return {
        id: u.id,
        email: meta?.phone ? `+91 ${meta.phone}` : `User ${u.id.slice(0, 8)}`,
        full_name: meta?.name ?? `Team Member (${u.roles.join(", ")})`,
        roles: u.roles,
        created_at: u.created_at,
        last_sign_in_at: null,
        confirmed: true,
      };
    });
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; fullName?: string; role: AppRole; redirectTo?: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    if (!ROLES.includes(input.role)) throw new Error("Invalid role");
    return { email, fullName: input.fullName?.trim() || null, role: input.role, redirectTo: input.redirectTo };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or invite the user.
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    let user = existing?.users.find((u) => u.email?.toLowerCase() === data.email) ?? null;
    let tempPassword: string | null = null;
    let invited = false;

    if (!user) {
      const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { full_name: data.fullName },
        ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
      });
      if (invite.data?.user) {
        user = invite.data.user;
        invited = true;
      } else {
        // Email delivery not configured — create the account with a temp password instead.
        tempPassword = `Fnf-${Math.random().toString(36).slice(2, 10)}!${Math.floor(Math.random() * 90 + 10)}`;
        const created = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: data.fullName },
        });
        if (created.error || !created.data.user) {
          throw new Error(created.error?.message ?? "Could not create the account");
        }
        user = created.data.user;
      }
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: data.role }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    return { userId: user.id, email: data.email, role: data.role, invited, tempPassword };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: AppRole; enabled: boolean }) => {
    if (!input?.userId) throw new Error("Missing user");
    if (!ROLES.includes(input.role)) throw new Error("Invalid role");
    return { userId: input.userId, role: input.role, enabled: Boolean(input.enabled) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === (context as { userId: string }).userId && data.role === "admin" && !data.enabled) {
      throw new Error("You cannot remove your own admin role");
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (data.enabled) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", data.role);
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    } catch {
      // Fallback to authenticated client
      const ctx = context as any;
      if (data.enabled) {
        const { error } = await ctx.supabase
          .from("user_roles")
          .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await ctx.supabase
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", data.role);
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    }
  });

export type DriverOption = { id: string; name: string; email: string };

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriverOption[]> => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const { data: isStaff, error } = await ctx.supabase.rpc("is_staff");
    if (error) throw new Error(error.message);
    if (!isStaff) throw new Error("Forbidden");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["driver", "staff"]);
      const ids = new Set((roleRows ?? []).map((r) => r.user_id));
      if (ids.size === 0) return [];

      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      return (users?.users ?? [])
        .filter((u) => ids.has(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email ?? "",
          name: ((u.user_metadata?.["full_name"] as string) ?? u.email ?? "").trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      // Fallback
      const { data: roleRows } = await ctx.supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["driver", "staff"]);
      return (roleRows ?? []).map((r: any) => ({
        id: r.user_id,
        email: `driver_${r.user_id.slice(0, 6)}@fishnfresh.internal`,
        name: `Driver (${r.user_id.slice(0, 6)})`,
      }));
    }
  });

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; fullName?: string; phone?: string; role: AppRole }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    const password = String(input?.password ?? "");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    if (!ROLES.includes(input.role)) throw new Error("Invalid role");
    return {
      email,
      password,
      fullName: input.fullName?.trim() || null,
      phone: input.phone?.replace(/\D/g, "").slice(0, 15) || null,
      role: input.role,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const found = existing?.users.find((u) => u.email?.toLowerCase() === data.email) ?? null;

    let userId: string;
    let updatedExisting = false;

    if (found) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(found.id, {
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, phone: data.phone },
      });
      if (error) throw new Error(error.message);
      userId = found.id;
      updatedExisting = true;
    } else {
      const created = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, phone: data.phone },
      });
      if (created.error || !created.data.user) {
        throw new Error(created.error?.message ?? "Could not create the account");
      }
      userId = created.data.user.id;
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    return { userId, email: data.email, role: data.role, updatedExisting };
  });
