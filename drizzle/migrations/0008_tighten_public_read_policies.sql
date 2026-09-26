ALTER FUNCTION public.auto_assign_nearest_driver(uuid) SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "Public read marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Public read active marketing_campaigns" ON public.marketing_campaigns
  FOR SELECT USING (is_active = true OR public.is_staff() OR public.is_admin());

DROP POLICY IF EXISTS "banners public read" ON public.banners;
CREATE POLICY "banners public read active" ON public.banners
  FOR SELECT USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "trust_badges_public_read" ON public.trust_badges;
CREATE POLICY "trust_badges_public_read_active" ON public.trust_badges
  FOR SELECT USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "promotions public read" ON public.promotions;
CREATE POLICY "promotions public read untargeted" ON public.promotions
  FOR SELECT USING ((active = true AND target_phone IS NULL) OR public.is_staff() OR public.is_admin());

DROP POLICY IF EXISTS "bookings public create" ON public.function_bookings;
CREATE POLICY "bookings public create validated" ON public.function_bookings
  FOR INSERT WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    AND status = 'pending'
    AND length(trim(customer_name)) > 0
    AND length(regexp_replace(customer_phone, '\D', '', 'g')) BETWEEN 10 AND 15
  );