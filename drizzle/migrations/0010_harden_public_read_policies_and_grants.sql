-- 1. Remove permissive "always true" read rules, keeping scoped ones
DROP POLICY IF EXISTS "banners_public_read" ON public.banners;
DROP POLICY IF EXISTS "trust_badges_public_read" ON public.trust_badges;
DROP POLICY IF EXISTS "marketing_campaigns_public_read" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "store_settings_public_read" ON public.store_settings;

-- 2. Ensure scoped public read rules exist (correct column names)
DROP POLICY IF EXISTS "banners public read active" ON public.banners;
CREATE POLICY "banners public read active" ON public.banners
  FOR SELECT TO anon, authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "trust_badges_public_read_active" ON public.trust_badges;
CREATE POLICY "trust_badges_public_read_active" ON public.trust_badges
  FOR SELECT TO anon, authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "Public read active marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Public read active marketing_campaigns" ON public.marketing_campaigns
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_staff() OR public.is_admin());

-- 3. Refresh Data API grants (these were lost when the earlier script rolled back)
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT SELECT ON public.trust_badges TO anon, authenticated;
GRANT SELECT ON public.marketing_campaigns TO anon, authenticated;
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.product_ai_benefits TO anon, authenticated;

GRANT ALL ON public.banners TO service_role;
GRANT ALL ON public.trust_badges TO service_role;
GRANT ALL ON public.marketing_campaigns TO service_role;
GRANT ALL ON public.store_settings TO service_role;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.product_ai_benefits TO service_role;

GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trust_badges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_ai_benefits TO authenticated;