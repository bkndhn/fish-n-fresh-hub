-- 1. Order-value discount bands for trade (wholesale) buyers
CREATE TABLE IF NOT EXISTS public.wholesale_discount_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,
  min_order_value NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wholesale_band_percent_range CHECK (discount_percent >= 0 AND discount_percent <= 50),
  CONSTRAINT wholesale_band_min_value CHECK (min_order_value >= 0)
);

GRANT SELECT ON public.wholesale_discount_bands TO authenticated;
GRANT ALL ON public.wholesale_discount_bands TO service_role;

ALTER TABLE public.wholesale_discount_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read active bands" ON public.wholesale_discount_bands;
CREATE POLICY "Signed-in users can read active bands"
ON public.wholesale_discount_bands
FOR SELECT
TO authenticated
USING (active IS TRUE OR public.is_admin_or_super());

DROP POLICY IF EXISTS "Admins manage bands" ON public.wholesale_discount_bands;
CREATE POLICY "Admins manage bands"
ON public.wholesale_discount_bands
FOR ALL
TO authenticated
USING (public.is_admin_or_super())
WITH CHECK (public.is_admin_or_super());

DROP TRIGGER IF EXISTS wholesale_discount_bands_updated_at ON public.wholesale_discount_bands;
CREATE TRIGGER wholesale_discount_bands_updated_at
BEFORE UPDATE ON public.wholesale_discount_bands
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Minimum bulk order value for trade buyers
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS wholesale_min_order_value NUMERIC NOT NULL DEFAULT 0;

-- 3. Band lookup helper
CREATE OR REPLACE FUNCTION public.wholesale_order_discount_percent(p_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(discount_percent), 0)
  FROM public.wholesale_discount_bands
  WHERE active IS TRUE
    AND min_order_value <= COALESCE(p_subtotal, 0);
$$;

-- 4. Pricing trigger: apply the order-value band on top of item slab pricing
CREATE OR REPLACE FUNCTION public.enforce_order_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  it jsonb;
  pid uuid;
  qty numeric;
  prod record;
  unit_price numeric;
  calc_subtotal numeric := 0;
  calc_gst numeric := 0;
  calc_discount numeric := 0;
  calc_fee numeric := 0;
  base_fee numeric := 0;
  free_over numeric := 0;
  promo record;
  new_items jsonb := '[]'::jsonb;
  wholesale boolean := false;
  extra_pct numeric := 0;
  band_pct numeric := 0;
  min_bulk numeric := 0;
BEGIN
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  SELECT true, COALESCE(w.extra_discount_percent, 0)
    INTO wholesale, extra_pct
  FROM public.wholesale_accounts w
  WHERE w.user_id = auth.uid() AND w.status = 'approved'
  LIMIT 1;
  wholesale := COALESCE(wholesale, false);
  extra_pct := COALESCE(extra_pct, 0);

  FOR it IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    BEGIN
      pid := (it->>'product_id')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid product in order';
    END;

    qty := COALESCE((it->>'qty')::numeric, 0);
    IF qty <= 0 OR qty > 100000 THEN
      RAISE EXCEPTION 'Invalid quantity in order';
    END IF;
    IF NOT wholesale AND qty > 1000 THEN
      RAISE EXCEPTION 'Invalid quantity in order';
    END IF;

    SELECT id, name, price, gst_percent, gst_included, is_available
      INTO prod FROM public.products WHERE id = pid;

    IF NOT FOUND OR prod.is_available IS NOT TRUE THEN
      RAISE EXCEPTION 'Product is not available';
    END IF;

    IF wholesale THEN
      unit_price := COALESCE(public.wholesale_unit_price(pid, qty), prod.price);
      IF extra_pct > 0 THEN
        unit_price := round(unit_price * (1 - LEAST(extra_pct, 50) / 100), 2);
      END IF;
    ELSE
      unit_price := prod.price;
    END IF;

    calc_subtotal := calc_subtotal + (unit_price * qty);
    IF COALESCE(prod.gst_percent, 0) > 0 AND prod.gst_included IS NOT TRUE THEN
      calc_gst := calc_gst + (unit_price * qty * prod.gst_percent / 100);
    END IF;

    new_items := new_items || jsonb_build_array(
      (it - 'price') || jsonb_build_object('price', unit_price, 'name', prod.name, 'qty', qty)
    );
  END LOOP;

  calc_gst := round(calc_gst);

  SELECT COALESCE(base_delivery_fee, delivery_fee, 0),
         COALESCE(free_delivery_over, 0),
         COALESCE(wholesale_min_order_value, 0)
    INTO base_fee, free_over, min_bulk
  FROM public.store_settings LIMIT 1;

  IF wholesale AND COALESCE(min_bulk, 0) > 0 AND calc_subtotal < min_bulk THEN
    RAISE EXCEPTION 'Minimum bulk order value is %', min_bulk;
  END IF;

  IF NEW.fulfillment_type = 'delivery' AND calc_subtotal < free_over THEN
    calc_fee := GREATEST(COALESCE(NEW.delivery_fee, 0), COALESCE(base_fee, 0));
  ELSE
    calc_fee := 0;
  END IF;

  IF NEW.coupon_code IS NOT NULL AND btrim(NEW.coupon_code) <> '' THEN
    SELECT * INTO promo FROM public.promotions
    WHERE upper(code) = upper(btrim(NEW.coupon_code))
      AND active IS TRUE
      AND (valid_from IS NULL OR valid_from <= current_date)
      AND (valid_to IS NULL OR valid_to >= current_date)
    LIMIT 1;

    IF FOUND AND calc_subtotal >= COALESCE(promo.min_order, 0) THEN
      IF promo.discount_type IN ('percentage', 'percent') THEN
        calc_discount := round(calc_subtotal * promo.value / 100);
      ELSE
        calc_discount := LEAST(calc_subtotal, promo.value);
      END IF;
    ELSE
      NEW.coupon_code := NULL;
      NEW.promotion_id := NULL;
      calc_discount := 0;
    END IF;
  END IF;

  IF wholesale THEN
    band_pct := COALESCE(public.wholesale_order_discount_percent(calc_subtotal), 0);
    IF band_pct > 0 THEN
      calc_discount := calc_discount + round(calc_subtotal * LEAST(band_pct, 50) / 100);
    END IF;
  END IF;

  calc_discount := LEAST(GREATEST(calc_discount, 0), calc_subtotal);

  NEW.items := new_items;
  NEW.subtotal := round(calc_subtotal, 2);
  NEW.gst_amount := calc_gst;
  NEW.delivery_fee := round(calc_fee, 2);
  NEW.discount := round(calc_discount, 2);
  NEW.additional_charges := COALESCE(NEW.additional_charges, 0);
  IF NEW.additional_charges < 0 THEN NEW.additional_charges := 0; END IF;
  NEW.total := GREATEST(0, NEW.subtotal - NEW.discount + NEW.delivery_fee + NEW.gst_amount + NEW.additional_charges);
  NEW.refund_amount := 0;
  NEW.upi_paid := false;
  NEW.payment_status := 'pending';
  NEW.status := 'pending';

  RETURN NEW;
END;
$function$;