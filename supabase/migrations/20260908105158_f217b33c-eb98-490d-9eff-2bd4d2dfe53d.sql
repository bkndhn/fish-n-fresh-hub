
-- 1. Admin-only gateway credentials
CREATE TABLE IF NOT EXISTS public.payment_gateway_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'none',
  api_key text,
  secret_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateway_credentials TO authenticated;
GRANT ALL ON public.payment_gateway_credentials TO service_role;

ALTER TABLE public.payment_gateway_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gateway creds admin only" ON public.payment_gateway_credentials;
CREATE POLICY "gateway creds admin only" ON public.payment_gateway_credentials
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS gateway_creds_updated_at ON public.payment_gateway_credentials;
CREATE TRIGGER gateway_creds_updated_at BEFORE UPDATE ON public.payment_gateway_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- migrate any existing values, then remove sensitive columns from the public table
INSERT INTO public.payment_gateway_credentials (provider, api_key, secret_key)
SELECT COALESCE(s.payment_gateway, 'none'), s.gateway_api_key, s.gateway_secret_key
FROM public.store_settings s
WHERE (s.gateway_api_key IS NOT NULL AND s.gateway_api_key <> '')
   OR (s.gateway_secret_key IS NOT NULL AND s.gateway_secret_key <> '');

ALTER TABLE public.store_settings DROP COLUMN IF EXISTS gateway_api_key;
ALTER TABLE public.store_settings DROP COLUMN IF EXISTS gateway_secret_key;

-- 2. Server-side order pricing
CREATE OR REPLACE FUNCTION public.enforce_order_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it jsonb;
  pid uuid;
  qty numeric;
  prod record;
  calc_subtotal numeric := 0;
  calc_gst numeric := 0;
  calc_discount numeric := 0;
  calc_fee numeric := 0;
  base_fee numeric := 0;
  free_over numeric := 0;
  promo record;
  new_items jsonb := '[]'::jsonb;
BEGIN
  -- staff/admin created orders (manual entry) keep their amounts
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    BEGIN
      pid := (it->>'product_id')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid product in order';
    END;

    qty := COALESCE((it->>'qty')::numeric, 0);
    IF qty <= 0 OR qty > 1000 THEN
      RAISE EXCEPTION 'Invalid quantity in order';
    END IF;

    SELECT id, name, price, gst_percent, gst_included, is_available
      INTO prod FROM public.products WHERE id = pid;

    IF NOT FOUND OR prod.is_available IS NOT TRUE THEN
      RAISE EXCEPTION 'Product is not available';
    END IF;

    calc_subtotal := calc_subtotal + (prod.price * qty);
    IF COALESCE(prod.gst_percent, 0) > 0 AND prod.gst_included IS NOT TRUE THEN
      calc_gst := calc_gst + (prod.price * qty * prod.gst_percent / 100);
    END IF;

    new_items := new_items || jsonb_build_array(
      (it - 'price') || jsonb_build_object('price', prod.price, 'name', prod.name, 'qty', qty)
    );
  END LOOP;

  calc_gst := round(calc_gst);

  SELECT COALESCE(base_delivery_fee, delivery_fee, 0), COALESCE(free_delivery_over, 0)
    INTO base_fee, free_over
  FROM public.store_settings LIMIT 1;

  IF NEW.fulfillment_type = 'delivery' AND calc_subtotal < free_over THEN
    -- distance-based surcharge is allowed, but never below the configured base fee
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
$$;

REVOKE ALL ON FUNCTION public.enforce_order_pricing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_enforce_pricing ON public.orders;
CREATE TRIGGER orders_enforce_pricing
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_pricing();
