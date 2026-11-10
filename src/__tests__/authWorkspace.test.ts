import { describe, expect, it } from 'vitest';
import { workspaceForRoles } from '../lib/authWorkspace';

describe('demo and real account workspaces', () => {
  it('routes administrators to the full administration console', () => {
    expect(workspaceForRoles(['user', 'admin'])).toBe('/admin');
    expect(workspaceForRoles(['super_admin'])).toBe('/admin');
  });
  it('routes each team role to its working console', () => {
    expect(workspaceForRoles(['manager', 'user'])).toBe('/admin');
    expect(workspaceForRoles(['cashier', 'user'])).toBe('/admin/pos');
    expect(workspaceForRoles(['staff', 'user'])).toBe('/admin/kitchen');
    expect(workspaceForRoles(['driver', 'user'])).toBe('/driver');
    expect(workspaceForRoles(['inventory_manager', 'user'])).toBe('/admin/products');
    expect(workspaceForRoles(['support_staff', 'user'])).toBe('/admin/support');
  });
  it('does not elevate customer or missing roles to admin', () => {
    expect(workspaceForRoles(['user'])).toBe('/orders');
    expect(workspaceForRoles([])).toBe('/orders');
  });
});