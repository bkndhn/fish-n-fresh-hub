-- Public-safe catalogue view: hides wholesale/bulk pricing and internal cost
-- from regular shoppers, guests and scrapers. Wholesale buyers and staff
-- still receive the real values.
CREATE OR REPLACE VIEW public.products_public AS
SELECT
  id, name, name_tamil, description, price, old_price, unit, category, image_url,
  stock, is_available, origin, rating, is_featured, tags, calories, protein,
  best_for, benefits, storage, catch_date, source_origin, lab_tested, traceability,
  recipe_title, recipe_steps, branch_id, created_at, updated_at, gst_included,
  gst_percent, allow_custom_qty, low_stock_threshold, is_bestseller,
  CASE WHEN public.is_staff() OR public.is_admin() THEN cost_price ELSE NULL END AS cost_price,
  hsn_code, pos_code, brand, model_number, warranty_period_months, specifications,
  aisle_location, variants, requires_serial,
  CASE WHEN public.is_staff() OR public.is_admin() OR public.is_wholesale_buyer(auth.uid())
       THEN wholesale_price ELSE NULL END AS wholesale_price,
  CASE WHEN public.is_staff() OR public.is_admin() OR public.is_wholesale_buyer(auth.uid())
       THEN wholesale_min_qty ELSE NULL END AS wholesale_min_qty,
  CASE WHEN public.is_staff() OR public.is_admin() OR public.is_wholesale_buyer(auth.uid())
       THEN wholesale_tiers ELSE NULL END AS wholesale_tiers,
  is_returnable, return_window_days, unlimited_stock
FROM public.products;

GRANT SELECT ON public.products_public TO anon, authenticated;
GRANT ALL ON public.products_public TO service_role;

-- Base table: no direct anonymous reads any more; signed-in reads stay allowed
-- (wholesale values on the base table are only reachable by signed-in accounts).
DROP POLICY IF EXISTS "products public read" ON public.products;
CREATE POLICY "products read authenticated" ON public.products
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.products FROM anon;