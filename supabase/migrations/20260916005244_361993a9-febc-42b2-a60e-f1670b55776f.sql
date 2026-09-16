-- 1. customer_subscriptions: remove anon-arbitrary-user_id insert
DROP POLICY IF EXISTS "Customers can manage their own subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Customers can update their own subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Customers can view their own subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Staff and admin delete subscriptions" ON public.customer_subscriptions;
DROP POLICY IF EXISTS "Guests create unlinked subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Guests create unlinked subscriptions"
  ON public.customer_subscriptions FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- 2. driver_cash_settlements: staff/admin only
DROP POLICY IF EXISTS "Allow staff and admin to insert settlements" ON public.driver_cash_settlements;
DROP POLICY IF EXISTS "Allow staff and admin to view settlements" ON public.driver_cash_settlements;
CREATE POLICY "Staff and admin view settlements"
  ON public.driver_cash_settlements FOR SELECT TO authenticated
  USING (public.is_staff() OR public.is_admin());
CREATE POLICY "Staff and admin insert settlements"
  ON public.driver_cash_settlements FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR public.is_admin());

-- 3. marketing_campaigns: writes restricted
DROP POLICY IF EXISTS "Public delete marketing_campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Public insert marketing_campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Public update marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Staff manage marketing_campaigns insert"
  ON public.marketing_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR public.is_admin());
CREATE POLICY "Staff manage marketing_campaigns update"
  ON public.marketing_campaigns FOR UPDATE TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());
CREATE POLICY "Staff manage marketing_campaigns delete"
  ON public.marketing_campaigns FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4. platform_audit_logs: no spoofed actor
DROP POLICY IF EXISTS "Service and super admin can insert audit logs" ON public.platform_audit_logs;

-- 5. platform_revocations: remove blanket read
DROP POLICY IF EXISTS "Authenticated can view revocations" ON public.platform_revocations;

-- 6. reviews: signed-in only, validated
DROP POLICY IF EXISTS "reviews public create" ON public.reviews;
DROP POLICY IF EXISTS "reviews authenticated create" ON public.reviews;
CREATE POLICY "reviews authenticated create"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND rating >= 1 AND rating <= 5
    AND length(coalesce(comment, '')) <= 1000
    AND length(coalesce(customer_name, '')) <= 80
  );
DROP POLICY IF EXISTS "reviews owner read" ON public.reviews;
CREATE POLICY "reviews owner read"
  ON public.reviews FOR SELECT TO authenticated
  USING (active = true OR public.is_admin());

-- 7. store_settings: move secrets to admin-only table
CREATE TABLE IF NOT EXISTS public.store_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_api_key text,
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_pass text,
  fcm_server_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_secrets TO authenticated;
GRANT ALL ON public.store_secrets TO service_role;
ALTER TABLE public.store_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store secrets admin only" ON public.store_secrets;
CREATE POLICY "store secrets admin only"
  ON public.store_secrets FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS set_store_secrets_updated_at ON public.store_secrets;
CREATE TRIGGER set_store_secrets_updated_at
  BEFORE UPDATE ON public.store_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.store_secrets (resend_api_key, smtp_host, smtp_port, smtp_user, smtp_pass, fcm_server_key)
SELECT s.resend_api_key, s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_pass, s.fcm_server_key
FROM public.store_settings s
WHERE NOT EXISTS (SELECT 1 FROM public.store_secrets)
LIMIT 1;

ALTER TABLE public.store_settings
  DROP COLUMN IF EXISTS resend_api_key,
  DROP COLUMN IF EXISTS smtp_host,
  DROP COLUMN IF EXISTS smtp_port,
  DROP COLUMN IF EXISTS smtp_user,
  DROP COLUMN IF EXISTS smtp_pass,
  DROP COLUMN IF EXISTS fcm_server_key;

-- 8. support conversations & messages: owner or staff only
DROP POLICY IF EXISTS "Allow public insert support_conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Allow public select support_conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Allow public update support_conversations" ON public.support_conversations;
CREATE POLICY "Own or staff view conversations"
  ON public.support_conversations FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff() OR public.is_admin());
CREATE POLICY "Customers create own conversations"
  ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() OR public.is_staff() OR public.is_admin());
CREATE POLICY "Own or staff update conversations"
  ON public.support_conversations FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff() OR public.is_admin())
  WITH CHECK (customer_id = auth.uid() OR public.is_staff() OR public.is_admin());

DROP POLICY IF EXISTS "Allow public insert support_messages" ON public.support_messages;
DROP POLICY IF EXISTS "Allow public select support_messages" ON public.support_messages;
CREATE POLICY "Own or staff view messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    public.is_staff() OR public.is_admin() OR EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = support_messages.conversation_id AND c.customer_id = auth.uid()
    )
  );
CREATE POLICY "Own or staff send messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff() OR public.is_admin() OR EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = support_messages.conversation_id AND c.customer_id = auth.uid()
    )
  );

-- 9. tenant_quotas: team only
DROP POLICY IF EXISTS "Authenticated can view tenant quotas" ON public.tenant_quotas;

-- 10. function hardening: fixed search_path
ALTER FUNCTION public.check_branch_creation_quota() SET search_path = public;
ALTER FUNCTION public.claim_super_admin_role() SET search_path = public;
ALTER FUNCTION public.get_auth_branch_id() SET search_path = public;
ALTER FUNCTION public.is_admin_or_super() SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;
ALTER FUNCTION public.prevent_role_tampering() SET search_path = public;
ALTER FUNCTION public.trigger_security_revocation(text, text, text) SET search_path = public;
ALTER FUNCTION public.user_has_branch_access(uuid) SET search_path = public;

-- trigger-only functions: not callable via API
REVOKE ALL ON FUNCTION public.check_branch_creation_quota() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_role_tampering() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_generate_order_delivery_pin() FROM PUBLIC, anon, authenticated;

-- signed-in only helpers
REVOKE ALL ON FUNCTION public.claim_super_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_super_admin_role() TO authenticated;
REVOKE ALL ON FUNCTION public.get_auth_branch_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_branch_id() TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin_or_super() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super() TO authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;
REVOKE ALL ON FUNCTION public.user_has_branch_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.trigger_security_revocation(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_security_revocation(text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.verify_and_deliver_order(uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_and_deliver_order(uuid, text, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.settle_driver_cod_orders_atomic(text, text, text, uuid, uuid[], numeric, numeric, numeric, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_driver_cod_orders_atomic(text, text, text, uuid, uuid[], numeric, numeric, numeric, text, uuid, text, text) TO authenticated;