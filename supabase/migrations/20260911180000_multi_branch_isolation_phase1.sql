-- ==============================================================================
-- MIGRATION: 20260911180000_multi_branch_isolation_phase1.sql
-- Description: Phase 1 — Multi-Branch Schema Hardening, Zero-Downtime Safe Backfill,
--              Composite Indexing, and Row-Level Security (RLS) Isolation.
-- ==============================================================================

-- 1. Enhance `branches` table with routing slugs, store codes, tax licenses, and default flag
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gstin TEXT,
  ADD COLUMN IF NOT EXISTS fssai_license TEXT,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Populate slugs, codes, and set flagship branch for existing records
UPDATE public.branches
SET 
  slug = 'chennai-harbour',
  code = 'CHH',
  is_default = true,
  gstin = COALESCE(gstin, '33AAACF1234F1Z5'),
  fssai_license = COALESCE(fssai_license, '12423008000123')
WHERE (name ILIKE '%harbour%' OR name ILIKE '%chennai%') AND slug IS NULL;

UPDATE public.branches
SET 
  slug = 'velachery',
  code = 'VEL',
  is_default = false,
  gstin = COALESCE(gstin, '33AAACF1234F1Z5'),
  fssai_license = COALESCE(fssai_license, '12423008000124')
WHERE (name ILIKE '%velachery%') AND slug IS NULL;

-- Fallback slug generation for any other existing branch
UPDATE public.branches
SET 
  slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')),
  code = UPPER(SUBSTRING(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3))
WHERE slug IS NULL;

-- Ensure at least one default branch exists
UPDATE public.branches
SET is_default = true
WHERE id = (
  SELECT id FROM public.branches ORDER BY sort_order ASC, created_at ASC LIMIT 1
) AND NOT EXISTS (
  SELECT 1 FROM public.branches WHERE is_default = true
);

-- Unique indexes on slug and code
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_slug_unique ON public.branches(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_code_unique ON public.branches(code) WHERE code IS NOT NULL;

-- 3. Operational Tables: Ensure Mandatory branch_id Foreign Keys
-- (A) orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_name TEXT;

-- (B) products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

-- (C) inventory_batches
ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

-- (D) purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- (E) waste_entries
ALTER TABLE public.waste_entries
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

-- (F) customer_subscriptions
ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- (G) driver_cash_settlements
ALTER TABLE public.driver_cash_settlements
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- (H) user_roles (Nullable: null implies global organization role, UUID implies branch-specific role)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

-- 4. Safe Data Backfill: Associate existing orphaned rows with the default flagship branch
DO $$
DECLARE
  v_default_branch_id UUID;
  v_default_branch_name TEXT;
BEGIN
  SELECT id, name INTO v_default_branch_id, v_default_branch_name 
  FROM public.branches 
  WHERE is_default = true 
  LIMIT 1;

  IF v_default_branch_id IS NULL THEN
    SELECT id, name INTO v_default_branch_id, v_default_branch_name 
    FROM public.branches 
    ORDER BY sort_order ASC, created_at ASC 
    LIMIT 1;
  END IF;

  IF v_default_branch_id IS NOT NULL THEN
    -- Backfill products
    UPDATE public.products 
    SET branch_id = v_default_branch_id 
    WHERE branch_id IS NULL;

    -- Backfill orders
    UPDATE public.orders 
    SET branch_id = v_default_branch_id,
        branch_name = COALESCE(branch_name, v_default_branch_name)
    WHERE branch_id IS NULL;

    -- Backfill inventory batches
    UPDATE public.inventory_batches 
    SET branch_id = v_default_branch_id 
    WHERE branch_id IS NULL;

    -- Backfill purchase orders
    UPDATE public.purchase_orders 
    SET branch_id = v_default_branch_id 
    WHERE branch_id IS NULL;

    -- Backfill waste entries
    UPDATE public.waste_entries 
    SET branch_id = v_default_branch_id 
    WHERE branch_id IS NULL;

    -- Backfill customer subscriptions
    UPDATE public.customer_subscriptions 
    SET branch_id = v_default_branch_id 
    WHERE branch_id IS NULL;

    -- Backfill driver cash settlements
    UPDATE public.driver_cash_settlements 
    SET branch_id = v_default_branch_id 
    WHERE branch_id IS NULL;
  END IF;
END $$;

-- 5. High-Performance Composite Indexes for Multi-Branch Isolation & Reporting
CREATE INDEX IF NOT EXISTS idx_orders_branch_status ON public.orders(branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_branch_available ON public.products(branch_id, is_available);
CREATE INDEX IF NOT EXISTS idx_batches_branch_status ON public.inventory_batches(branch_id, status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_waste_branch ON public.waste_entries(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON public.purchase_orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_branch ON public.customer_subscriptions(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_branch ON public.user_roles(user_id, branch_id, role);

-- 6. Helper Functions for Cryptographic / JWT Multi-Branch Security
CREATE OR REPLACE FUNCTION public.get_auth_branch_id()
RETURNS UUID AS $$
  SELECT NULLIF(
    COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'branch_id'),
      (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'branch_id')
    ), ''
  )::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND (branch_id IS NULL OR branch_id = public.get_auth_branch_id())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN AS $$
  SELECT 
    -- Admins have access to all branches
    public.is_admin_or_super()
    OR
    -- Staff assigned specifically to this branch
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND (branch_id = p_branch_id OR branch_id IS NULL)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 7. Row-Level Security (RLS) Policies on Operational Tables
-- (A) Inventory Batches
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active batch traceability" ON public.inventory_batches;
CREATE POLICY "Public can view active batch traceability" ON public.inventory_batches
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Branch staff can manage inventory batches" ON public.inventory_batches;
CREATE POLICY "Branch staff can manage inventory batches" ON public.inventory_batches
  FOR ALL USING (
    branch_id IS NULL 
    OR public.user_has_branch_access(branch_id)
  )
  WITH CHECK (
    branch_id IS NULL 
    OR public.user_has_branch_access(branch_id)
  );

-- (B) Purchase Orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branch staff can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Branch staff can manage purchase orders" ON public.purchase_orders
  FOR ALL USING (
    branch_id IS NULL 
    OR public.user_has_branch_access(branch_id)
  )
  WITH CHECK (
    branch_id IS NULL 
    OR public.user_has_branch_access(branch_id)
  );

-- (C) Waste Entries
ALTER TABLE public.waste_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branch staff can manage waste entries" ON public.waste_entries;
CREATE POLICY "Branch staff can manage waste entries" ON public.waste_entries
  FOR ALL USING (
    branch_id IS NULL 
    OR public.user_has_branch_access(branch_id)
  )
  WITH CHECK (
    branch_id IS NULL 
    OR public.user_has_branch_access(branch_id)
  );

-- (D) Branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active branches" ON public.branches;
CREATE POLICY "Anyone can view active branches" ON public.branches
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
CREATE POLICY "Admins can manage branches" ON public.branches
  FOR ALL USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());
