/**
 * Server-side authorization helpers for server functions.
 *
 * TanStack server functions are reachable as plain HTTP endpoints, so every
 * handler that touches privileged data must verify the caller itself.
 * These helpers read the bearer token off the incoming request, validate it
 * against Supabase Auth, and check roles using the service-role client.
 */
import { getRequest } from "@tanstack/react-start/server";

export type CallerRole =
  | "admin"
  | "super_admin"
  | "manager"
  | "staff"
  | "cashier"
  | "inventory_manager"
  | "support_staff"
  | "driver"
  | "user";

const STAFF_ROLES: CallerRole[] = [
  "admin",
  "super_admin",
  "manager",
  "staff",
  "cashier",
  "inventory_manager",
  "support_staff",
  "driver",
];

const ADMIN_ROLES: CallerRole[] = ["admin", "super_admin", "manager"];

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function bearerToken(): string | null {
  try {
    const request = getRequest();
    const header = request?.headers?.get("authorization") ?? null;
    if (!header || !header.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    if (!token || token.split(".").length !== 3) return null;
    return token;
  } catch {
    return null;
  }
}

/** Returns the signed-in caller's user id, or null when the request is anonymous. */
export async function getCallerUserId(): Promise<string | null> {
  const token = bearerToken();
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function getCallerRoles(userId: string): Promise<CallerRole[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const roles: CallerRole[] = [];

  try {
    const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
    if (data && data.length > 0) {
      roles.push(...data.map((r) => r.role as CallerRole));
    }
  } catch {
    // ignore
  }

  // Roles come ONLY from the user_roles table. User/app metadata is never trusted.
  return roles;
}

/** Throws unless the caller is signed in. Returns the caller's user id. */
export async function requireUser(): Promise<string> {
  const userId = await getCallerUserId();
  if (!userId) throw new AuthorizationError("Please sign in to continue");
  return userId;
}

/** Throws unless the caller holds a staff-side role. */
export async function requireStaff(): Promise<{ userId: string; roles: CallerRole[] }> {
  const userId = await requireUser();
  const roles = await getCallerRoles(userId);
  if (!roles.some((r) => STAFF_ROLES.includes(r))) {
    throw new AuthorizationError("Forbidden: staff access required");
  }
  return { userId, roles };
}

/** Throws unless the caller is an admin or super admin. */
export async function requireAdmin(): Promise<{ userId: string; roles: CallerRole[] }> {
  const userId = await requireUser();
  const roles = await getCallerRoles(userId);
  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    throw new AuthorizationError("Forbidden: admin access required");
  }
  return { userId, roles };
}

export async function isStaffCaller(): Promise<boolean> {
  try {
    await requireStaff();
    return true;
  } catch {
    return false;
  }
}

/**
 * Confirms the caller may act on a specific order: either they own it, they are
 * staff, or (for guest orders) they present the phone number used on the order.
 */
export async function requireOrderAccess(
  orderId: string,
  guestPhone?: string | null | undefined,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, customer_phone")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) throw new AuthorizationError("Order not found");

  const userId = await getCallerUserId();
  if (userId && order.user_id && order.user_id === userId) return;

  if (userId) {
    const roles = await getCallerRoles(userId);
    if (roles.some((r) => STAFF_ROLES.includes(r))) return;
  }

  const supplied = String(guestPhone ?? "").replace(/\D/g, "");
  const actual = String(order.customer_phone ?? "").replace(/\D/g, "");
  if (supplied.length >= 10 && actual.length >= 10 && supplied.slice(-10) === actual.slice(-10)) {
    return;
  }

  throw new AuthorizationError("You are not allowed to access this order");
}
