-- ============================================================================
-- Migration: Operating Expenses & Branch-Isolated P&L Architecture
-- Description:
--   1. expenses: Operating expense ledger with branch isolation and categories.
--   2. RLS Policies: Tenant Admins view consolidated/branch; Managers view assigned branch only.
--   3. Composite indexes for high-speed date range and category filtering.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'rent_lease',
    'salaries_wages',
    'electricity_utilities',
    'packaging_bags',
    'cold_storage_ice',
    'fuel_logistics',
    'marketing_ads',
    'maintenance_repairs',
    'licenses_taxes',
    'other'
  )),
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'card', 'cheque')),
  vendor_name TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON public.expenses(branch_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Select Policy
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
CREATE POLICY "expenses_select_policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
    OR (branch_id IS NULL AND public.get_auth_branch_id() IS NULL)
  );

-- Insert Policy
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
CREATE POLICY "expenses_insert_policy" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
  );

-- Update Policy
DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
CREATE POLICY "expenses_update_policy" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
  );

-- Delete Policy
DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;
CREATE POLICY "expenses_delete_policy" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super()
    OR branch_id = public.get_auth_branch_id()
  );
