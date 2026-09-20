-- 1. Branch financial/identity fields: no longer readable through the Data API
DROP POLICY IF EXISTS "Anyone can view active branches" ON public.branches;

CREATE POLICY "branches read active safe columns"
ON public.branches FOR SELECT
TO anon, authenticated
USING (is_active = true);

REVOKE SELECT ON public.branches FROM anon, authenticated;
GRANT SELECT (
  id, name, address, phone, lat, lng, open_time, close_time,
  delivery_radius_km, is_active, sort_order, slug, code, is_default,
  min_order_amount, created_at, updated_at
) ON public.branches TO anon, authenticated;
GRANT ALL ON public.branches TO service_role;

-- 2. Reviews: customer_phone is never readable by visitors or signed-in users
DROP POLICY IF EXISTS "reviews public read active" ON public.reviews;

CREATE POLICY "reviews read active safe columns"
ON public.reviews FOR SELECT
TO anon, authenticated
USING (active = true);

REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (
  id, product_id, product_name, order_id, customer_name, rating, comment,
  photo_url, verified, admin_reply, active, created_at, updated_at
) ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

-- 3. Public store settings view must run with the caller's own permissions
ALTER VIEW public.store_settings_public SET (security_invoker = on);

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'store_settings_public';

  EXECUTE format('GRANT SELECT (%s) ON public.store_settings TO anon', cols);
END $$;

GRANT SELECT ON public.store_settings_public TO anon, authenticated;

-- 4. Staff without an explicit branch assignment no longer get every branch
CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin_or_super()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND branch_id = p_branch_id
    );
$function$;

-- 5. Trigger-only SECURITY DEFINER function must not be callable by visitors
REVOKE ALL ON FUNCTION public.protect_order_financials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_order_financials() TO service_role;
