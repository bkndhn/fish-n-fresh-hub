import type { AppRole } from './admin';

/** Navigation only; database and server permissions remain authoritative. */
export function workspaceForRoles(roles: readonly AppRole[]) {
  if (roles.includes('super_admin') || roles.includes('admin') || roles.includes('manager')) return '/admin';
  if (roles.includes('cashier')) return '/admin/pos';
  if (roles.includes('driver')) return '/driver';
  if (roles.includes('inventory_manager')) return '/admin/products';
  if (roles.includes('support_staff')) return '/admin/support';
  if (roles.includes('staff')) return '/admin/kitchen';
  return '/orders';
}