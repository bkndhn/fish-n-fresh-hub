import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/authz.server";

/**
 * Realtime broadcasts are not authenticated, so a force-logout message alone
 * must never end a session. The client calls this to confirm a matching
 * revocation really was recorded by an administrator in the last few minutes.
 */
export const confirmSecurityRevocation = createServerFn({ method: "POST" })
  .inputValidator((input: { scope: string; targetId?: string | null }) => ({
    scope: String(input?.scope ?? ""),
    targetId: input?.targetId ? String(input.targetId) : null,
  }))
  .handler(async ({ data }): Promise<{ valid: boolean; reason?: string }> => {
    const userId = await requireUser();
    if (!["global", "branch", "user"].includes(data.scope)) return { valid: false };
    // Callers may only confirm revocations that actually apply to them.
    if (data.scope === "user" && data.targetId !== userId) return { valid: false };
    if (data.scope === "branch") {
      if (!data.targetId) return { valid: false };
      // Only staff assigned to that branch (or store-wide admins) may confirm it.
      const { supabaseAdmin: sa } = await import("@/integrations/supabase/client.server");
      const { data: roleRows } = await sa
        .from("user_roles")
        .select("role, branch_id")
        .eq("user_id", userId);
      const allowed = (roleRows ?? []).some(
        (r: { role: string; branch_id: string | null }) =>
          (["admin", "super_admin"].includes(r.role) && !r.branch_id) || r.branch_id === data.targetId,
      );
      if (!allowed) return { valid: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let query = supabaseAdmin
      .from("platform_revocations")
      .select("id, reason, target_id, revoked_at")
      .eq("scope", data.scope)
      .gte("revoked_at", since)
      .order("revoked_at", { ascending: false })
      .limit(1);

    query = data.targetId ? query.eq("target_id", data.targetId) : query.is("target_id", null);

    const { data: rows, error } = await query;
    if (error || !rows?.length) return { valid: false };
    return { valid: true, reason: rows[0]?.reason ?? "Security maintenance" };
  });
