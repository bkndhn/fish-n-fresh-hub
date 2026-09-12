-- ============================================================================
-- Migration: Self Claim Admin Role RPC (Zero-Friction Dev & Testing Mode)
-- Description:
--   1. Adds claim_super_admin_role() SECURITY DEFINER function so authenticated
--      developers/testers can activate super_admin and admin roles without
--      needing direct SQL access.
--   2. Ensures the staff table and user_roles table are kept synchronized.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_super_admin_role()
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You must be logged into Supabase Auth before claiming administrative access.'
    );
  END IF;

  -- Lookup email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Upsert super_admin and admin roles into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES 
    (v_user_id, 'admin'::public.app_role),
    (v_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Upsert into staff table so POS and cashier systems recognize the user
  INSERT INTO public.staff (user_id, full_name, role, is_active)
  VALUES 
    (v_user_id, COALESCE(v_user_email, 'Store Administrator'), 'admin', true)
  ON CONFLICT (user_id) DO UPDATE 
  SET is_active = true, role = 'admin';

  -- Log action to platform audit logs if table exists
  BEGIN
    INSERT INTO public.platform_audit_logs (actor_id, actor_role, action, target_type, target_id, details)
    VALUES (
      v_user_id,
      'super_admin',
      'SELF_CLAIM_ADMIN_ACCESS',
      'user_roles',
      v_user_id::text,
      jsonb_build_object('claimed_at', now(), 'email', v_user_email)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore audit log errors if table not ready
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Super Admin & Store Admin roles granted successfully to ' || COALESCE(v_user_email, v_user_id::text),
    'user_id', v_user_id,
    'email', v_user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_super_admin_role() TO authenticated;
