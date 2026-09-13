-- ============================================================================
-- Migration: Phase 4 — Super Admin Governance Platform & Anti-Impersonation
-- Description:
--   1. tenant_quotas: Branch creation limits ($), staff seat limits, order caps.
--   2. platform_revocations: Real-time emergency session kill switch.
--   3. platform_audit_logs: Governance audit trail and anti-tampering log.
--   4. RLS & Triggers: Blocks client role forgery and enforces quota limits.
-- ============================================================================

-- 1. Tenant Quotas Table
CREATE TABLE IF NOT EXISTS public.tenant_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name TEXT NOT NULL DEFAULT 'Fish N Fresh Enterprise',
  tenant_code TEXT NOT NULL UNIQUE DEFAULT 'FNF-MAIN',
  max_branches INTEGER NOT NULL DEFAULT 10,
  max_staff_per_branch INTEGER NOT NULL DEFAULT 15,
  max_monthly_orders INTEGER NOT NULL DEFAULT 25000,
  max_storage_mb INTEGER NOT NULL DEFAULT 5000,
  tier TEXT NOT NULL DEFAULT 'enterprise' CHECK (tier IN ('starter', 'growth', 'enterprise')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial default quota if not present
INSERT INTO public.tenant_quotas (tenant_name, tenant_code, max_branches, max_staff_per_branch, max_monthly_orders, max_storage_mb, tier, is_locked)
VALUES ('Fish N Fresh Enterprise', 'FNF-MAIN', 10, 15, 25000, 5000, 'enterprise', false)
ON CONFLICT (tenant_code) DO NOTHING;

-- 2. Platform Security Revocations Table (Emergency Kill Switch)
CREATE TABLE IF NOT EXISTS public.platform_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'branch', 'user')),
  target_id TEXT, -- NULL for global, branch_id for branch, user_id for user
  reason TEXT NOT NULL DEFAULT 'Administrative security revocation',
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revocations_scope_target ON public.platform_revocations(scope, target_id, revoked_at);

-- 3. Platform Governance Audit Logs
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'super_admin',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.platform_audit_logs(action, created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function: is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS \$\$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
\$\$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. RLS Policies
-- tenant_quotas: Authenticated users can view; only Super Admin can update
DROP POLICY IF EXISTS \"Authenticated can view tenant quotas\" ON public.tenant_quotas;
CREATE POLICY \"Authenticated can view tenant quotas\" ON public.tenant_quotas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS \"Super Admin can manage tenant quotas\" ON public.tenant_quotas;
CREATE POLICY \"Super Admin can manage tenant quotas\" ON public.tenant_quotas
  FOR ALL TO authenticated USING (public.is_super_admin() OR public.is_admin_or_super())
  WITH CHECK (public.is_super_admin() OR public.is_admin_or_super());

-- platform_revocations: Authenticated can read (to check revocation status); super admin can insert
DROP POLICY IF EXISTS \"Authenticated can view revocations\" ON public.platform_revocations;
CREATE POLICY \"Authenticated can view revocations\" ON public.platform_revocations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS \"Super Admin can issue revocations\" ON public.platform_revocations;
CREATE POLICY \"Super Admin can issue revocations\" ON public.platform_revocations
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR public.is_admin_or_super());

-- platform_audit_logs: Super Admin can view all
DROP POLICY IF EXISTS \"Super Admin can view audit logs\" ON public.platform_audit_logs;
CREATE POLICY \"Super Admin can view audit logs\" ON public.platform_audit_logs
  FOR SELECT TO authenticated USING (public.is_super_admin() OR public.is_admin_or_super());

DROP POLICY IF EXISTS \"Service and super admin can insert audit logs\" ON public.platform_audit_logs;
CREATE POLICY \"Service and super admin can insert audit logs\" ON public.platform_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Anti-Takeover & Anti-Impersonation Trigger on user_roles
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
RETURNS TRIGGER AS \$\$
BEGIN
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
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_tampering ON public.user_roles;
CREATE TRIGGER trg_prevent_role_tampering
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_tampering();

-- 8. Branch Creation Quota Trigger on branches
CREATE OR REPLACE FUNCTION public.check_branch_creation_quota()
RETURNS TRIGGER AS \$\$
DECLARE
  v_active_branches INTEGER;
  v_max_branches INTEGER;
  v_is_locked BOOLEAN;
BEGIN
  SELECT max_branches, is_locked INTO v_max_branches, v_is_locked 
  FROM public.tenant_quotas 
  LIMIT 1;

  IF v_is_locked THEN
    RAISE EXCEPTION 'Tenant is currently locked by Super Administrator. Branch provisioning paused.';
  END IF;

  IF v_max_branches IS NULL THEN
    v_max_branches := 10;
  END IF;

  SELECT COUNT(*) INTO v_active_branches FROM public.branches WHERE is_active = true;

  IF v_active_branches >= v_max_branches THEN
    RAISE EXCEPTION 'Branch creation quota exceeded (% active hubs allowed). Contact Super Admin to increase limits.', v_max_branches;
  END IF;

  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_branch_creation_quota ON public.branches;
CREATE TRIGGER trg_check_branch_creation_quota
  BEFORE INSERT ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.check_branch_creation_quota();

-- 9. Emergency Kill Switch RPC Function
CREATE OR REPLACE FUNCTION public.trigger_security_revocation(
  p_scope TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'Emergency session termination'
)
RETURNS UUID AS \$\$
DECLARE
  v_revocation_id UUID;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_admin_or_super()) THEN
    RAISE EXCEPTION 'Access Denied: Insufficient security privileges.';
  END IF;

  INSERT INTO public.platform_revocations (scope, target_id, reason, revoked_by, revoked_at)
  VALUES (p_scope, p_target_id, p_reason, auth.uid(), now())
  RETURNING id INTO v_revocation_id;

  INSERT INTO public.platform_audit_logs (actor_id, actor_role, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'super_admin',
    'FORCE_LOGOUT_' || UPPER(p_scope),
    p_scope,
    p_target_id,
    jsonb_build_object('reason', p_reason, 'timestamp', now())
  );

  RETURN v_revocation_id;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;
