-- 1. product_ai_benefits: staff-only writes
DROP POLICY IF EXISTS "Authenticated can insert or update ai benefits" ON public.product_ai_benefits;
CREATE POLICY "Staff manage ai benefits" ON public.product_ai_benefits
  FOR ALL TO authenticated USING (public.is_staff() OR public.is_admin_or_super())
  WITH CHECK (public.is_staff() OR public.is_admin_or_super());

-- 2. platform_audit_logs: staff-only inserts bound to the caller
DROP POLICY IF EXISTS "Signed in users can append audit logs" ON public.platform_audit_logs;
CREATE POLICY "Staff append audit logs" ON public.platform_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_staff() OR public.is_admin_or_super()) AND actor_id = auth.uid());

-- 3. Remove permissive branch_id IS NULL public policies
DROP POLICY IF EXISTS "Branch staff can manage inventory batches" ON public.inventory_batches;
CREATE POLICY "Branch staff manage inventory batches" ON public.inventory_batches
  FOR ALL TO authenticated
  USING ((public.is_staff() OR public.is_admin_or_super()) AND (branch_id IS NULL OR public.user_has_branch_access(branch_id)))
  WITH CHECK ((public.is_staff() OR public.is_admin_or_super()) AND (branch_id IS NULL OR public.user_has_branch_access(branch_id)));

DROP POLICY IF EXISTS "Anyone can view batch traceability" ON public.inventory_batches;

DROP POLICY IF EXISTS "Branch staff can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Branch staff manage purchase orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING ((public.is_staff() OR public.is_admin_or_super()) AND (branch_id IS NULL OR public.user_has_branch_access(branch_id)))
  WITH CHECK ((public.is_staff() OR public.is_admin_or_super()) AND (branch_id IS NULL OR public.user_has_branch_access(branch_id)));

DROP POLICY IF EXISTS "Branch staff can manage waste entries" ON public.waste_entries;
CREATE POLICY "Branch staff manage waste entries" ON public.waste_entries
  FOR ALL TO authenticated
  USING ((public.is_staff() OR public.is_admin_or_super()) AND (branch_id IS NULL OR public.user_has_branch_access(branch_id)))
  WITH CHECK ((public.is_staff() OR public.is_admin_or_super()) AND (branch_id IS NULL OR public.user_has_branch_access(branch_id)));

-- 4. reviews: hide reviewer phone numbers from public reads
REVOKE SELECT (customer_phone) ON public.reviews FROM anon, authenticated;

-- 5. fcm_tokens: no anonymous token registration
DROP POLICY IF EXISTS "Anon insert fcm token" ON public.fcm_tokens;
DROP POLICY IF EXISTS "User manage own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users manage own fcm tokens" ON public.fcm_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.fcm_tokens FROM anon;

-- 6. branch identity comes from app_metadata only (user_metadata is user-editable)
CREATE OR REPLACE FUNCTION public.get_auth_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NULLIF(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'branch_id'),
    ''
  )::UUID;
$function$;