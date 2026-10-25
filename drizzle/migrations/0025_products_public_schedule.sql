CREATE OR REPLACE VIEW public.products_public AS SELECT id, name, name_tamil, description, price, old_price, unit, category, image_url, stock, is_available, origin, rating, is_featured, tags, calories, protein, best_for, benefits, storage, catch_date, source_origin, lab_tested, traceability, recipe_title, recipe_steps, branch_id, created_at, updated_at, gst_included, gst_percent, allow_custom_qty, low_stock_threshold, is_bestseller,
CASE WHEN is_staff() OR is_admin() THEN cost_price ELSE NULL::numeric END AS cost_price,
hsn_code, pos_code, brand, model_number, warranty_period_months, specifications, aisle_location, variants, requires_serial,
CASE WHEN is_staff() OR is_admin() OR is_wholesale_buyer(auth.uid()) THEN wholesale_price ELSE NULL::numeric END AS wholesale_price,
CASE WHEN is_staff() OR is_admin() OR is_wholesale_buyer(auth.uid()) THEN wholesale_min_qty ELSE NULL::numeric END AS wholesale_min_qty,
CASE WHEN is_staff() OR is_admin() OR is_wholesale_buyer(auth.uid()) THEN wholesale_tiers ELSE NULL::jsonb END AS wholesale_tiers,
is_returnable, return_window_days, unlimited_stock, available_from, available_to, available_days, expiry_date
FROM public.products;