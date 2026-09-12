-- ============================================================================
-- Migration: Fix Role Tampering Trigger, Role Grant RPC & Platform Clients
-- Description:
--   1. Fixes prevent_role_tampering() to allow direct Table Editor & SQL Editor updates.
--   2. Adds super_admin_grant_role() RPC for effortless role management.
--   3. Adds platform_clients table for multi-tenant fleet persistence.
--   4. Grants admin and super_admin to active developer account.
-- ============================================================================

-- 1. Fix Anti-Takeover & Anti-Tampering Trigger on user_roles
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
RETURNS TRIGGER AS $$
BEGIN
  -- Always allow direct Postgres superuser / dashboard / service_role / SQL Editor operations
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') 
     OR auth.role() = 'service_role' 
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent client-side self-elevation to admin or super_admin
  IF (NEW.role IN ('admin', 'super_admin')) THEN
    -- If an existing super_admin exists, only super_admin can assign admin/super_admin
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
      IF NOT public.is_super_admin() THEN
        -- Log attempted elevation
        INSERT INTO public.platform_audit_logs (actor_id, actor_role, action, target_type, target_id, details)
        VALUES (
          auth.uid(),
          'unauthorized',
          'BLOCKED_PRIVILEGE_ESCALATION',
          'user_roles',
          NEW.user_id::text,
          jsonb_build_object('attempted_role', NEW.role, 'blocked_at', now())
        );
        RAISE EXCEPTION 'Access Denied: Only Super Administrators can grant administrative permissions.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_prevent_role_tampering ON public.user_roles;
CREATE TRIGGER trg_prevent_role_tampering
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_tampering();

-- 2. Secure RPC to grant/update user role (callable from app or SQL Editor)
CREATE OR REPLACE FUNCTION public.super_admin_grant_role(
  target_email TEXT,
  new_role TEXT,
  target_branch_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();

  -- Verify caller is super_admin or database admin
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') 
     AND auth.role() != 'service_role' 
     AND v_actor_id IS NOT NULL THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only Super Administrators can execute super_admin_grant_role.';
    END IF;
  END IF;

  -- Find user in auth.users by email
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE lower(email) = lower(trim(target_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User with email ' || target_email || ' not found in auth.users.');
  END IF;

  -- Upsert role into user_roles
  INSERT INTO public.user_roles (user_id, role, branch_id)
  VALUES (v_user_id, new_role::public.app_role, target_branch_id)
  ON CONFLICT (user_id, role) DO UPDATE
  SET branch_id = EXCLUDED.branch_id;

  -- Log to platform audit trail
  INSERT INTO public.platform_audit_logs (actor_id, actor_role, action, target_type, target_id, details)
  VALUES (
    v_actor_id,
    'super_admin',
    'GRANT_USER_ROLE',
    'user_roles',
    v_user_id::text,
    jsonb_build_object('target_email', target_email, 'granted_role', new_role, 'branch_id', target_branch_id)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'user_id', v_user_id, 
    'email', target_email, 
    'role', new_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Platform Clients Table (Persistent Multi-Tenant Fleet)
CREATE TABLE IF NOT EXISTS public.platform_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  tenant_code TEXT NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  vertical TEXT NOT NULL DEFAULT 'seafood',
  domain TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'growth' CHECK (tier IN ('starter', 'growth', 'enterprise', 'custom')),
  max_branches INTEGER NOT NULL DEFAULT 8,
  max_staff_per_branch INTEGER NOT NULL DEFAULT 15,
  max_monthly_orders INTEGER NOT NULL DEFAULT 20000,
  max_storage_mb INTEGER NOT NULL DEFAULT 5000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  onboarding_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins and service role can manage platform clients" ON public.platform_clients;
CREATE POLICY "Super admins and service role can manage platform clients" ON public.platform_clients
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_admin_or_super())
  WITH CHECK (public.is_super_admin() OR public.is_admin_or_super());

-- Seed initial default platform clients if empty
INSERT INTO public.platform_clients (client_name, tenant_code, owner_name, owner_email, owner_phone, vertical, domain, tier, max_branches, max_staff_per_branch, max_monthly_orders, is_active, is_locked)
VALUES 
  ('Fish N Fresh Hub (Flagship)', 'FNF-MAIN', 'Karthik Raja', 'owner@fishnfresh.in', '+91 98430 61919', 'seafood', 'fishnfresh.in', 'enterprise', 10, 15, 25000, true, false),
  ('Bay Catch Coastal Direct', 'BAY-CATCH', 'Anand V.', 'anand@baycatch.in', '+91 98411 22334', 'seafood', 'baycatch.in', 'growth', 8, 15, 20000, true, false),
  ('Halal Fresh Poultry & Meat', 'HALAL-FRESH', 'Zameer Ahmed', 'zameer@halalfresh.in', '+91 98422 33445', 'chicken_meat', 'halalfresh.in', 'growth', 5, 10, 15000, true, false)
ON CONFLICT (tenant_code) DO NOTHING;

-- 4. Automatically ensure developer user has admin and super_admin permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '6fc4eabb-2eb2-47aa-baac-6793e4b9cf79'::uuid) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES 
      ('6fc4eabb-2eb2-47aa-baac-6793e4b9cf79'::uuid, 'admin'),
      ('6fc4eabb-2eb2-47aa-baac-6793e4b9cf79'::uuid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
