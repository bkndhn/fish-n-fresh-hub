-- Wholesale pricing fields on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS wholesale_price numeric,
  ADD COLUMN IF NOT EXISTS wholesale_min_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Wholesale (retail-store buyer) accounts
CREATE TABLE IF NOT EXISTS public.wholesale_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_name text,
  phone text NOT NULL,
  email text,
  gstin text,
  address text,
  status text NOT NULL DEFAULT 'pending',
  extra_discount_percent numeric NOT NULL DEFAULT 0,
  credit_limit numeric NOT NULL DEFAULT 0,
  notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wholesale_accounts_user_idx ON public.wholesale_accounts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wholesale_accounts_phone_idx ON public.wholesale_accounts(phone);

GRANT SELECT, INSERT, UPDATE ON public.wholesale_accounts TO authenticated;
GRANT ALL ON public.wholesale_accounts TO service_role;

ALTER TABLE public.wholesale_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wholesale own read" ON public.wholesale_accounts;
CREATE POLICY "wholesale own read" ON public.wholesale_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "wholesale own apply" ON public.wholesale_accounts;
CREATE POLICY "wholesale own apply" ON public.wholesale_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "wholesale admin manage" ON public.wholesale_accounts;
CREATE POLICY "wholesale admin manage" ON public.wholesale_accounts
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE OR REPLACE FUNCTION public.set_updated_at_wholesale()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_wholesale_updated_at ON public.wholesale_accounts;
CREATE TRIGGER trg_wholesale_updated_at BEFORE UPDATE ON public.wholesale_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_wholesale();

-- Is the given user an approved wholesale buyer?
CREATE OR REPLACE FUNCTION public.is_wholesale_buyer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wholesale_accounts
    WHERE user_id = _user_id AND status = 'approved'
  );
$$;

-- Resolve the unit price for a product at a given quantity for a wholesale buyer
CREATE OR REPLACE FUNCTION public.wholesale_unit_price(p_product_id uuid, p_qty numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prod record;
  tier jsonb;
  best numeric;
  tier_qty numeric;
  tier_price numeric;
BEGIN
  SELECT price, wholesale_price, wholesale_min_qty, wholesale_tiers
    INTO prod FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  best := prod.price;

  IF prod.wholesale_price IS NOT NULL
     AND p_qty >= COALESCE(prod.wholesale_min_qty, 0)
     AND prod.wholesale_price < best THEN
    best := prod.wholesale_price;
  END IF;

  IF jsonb_typeof(prod.wholesale_tiers) = 'array' THEN
    FOR tier IN SELECT * FROM jsonb_array_elements(prod.wholesale_tiers)
    LOOP
      tier_qty := COALESCE((tier->>'min_qty')::numeric, 0);
      tier_price := (tier->>'price')::numeric;
      IF tier_price IS NOT NULL AND p_qty >= tier_qty AND tier_price < best THEN
        best := tier_price;
      END IF;
    END LOOP;
  END IF;

  RETURN round(best, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_wholesale_buyer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wholesale_unit_price(uuid, numeric) TO authenticated, anon;

-- Wholesale-aware order pricing trigger
CREATE OR REPLACE FUNCTION public.enforce_order_pricing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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

  SELECT COALESCE(base_delivery_fee, delivery_fee, 0), COALESCE(free_delivery_over, 0)
    INTO base_fee, free_over
  FROM public.store_settings LIMIT 1;

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