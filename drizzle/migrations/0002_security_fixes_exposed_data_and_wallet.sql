-- 1. Function search_path hardening
ALTER FUNCTION public.set_updated_at_wholesale() SET search_path = public;

-- 2. Revoke anon EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_wholesale_buyer(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wholesale_unit_price(uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wholesale_order_discount_percent(numeric) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_wholesale_buyer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wholesale_unit_price(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wholesale_order_discount_percent(numeric) TO authenticated, service_role;

-- 3. Reviews: hide customer_phone from anonymous visitors
REVOKE SELECT ON public.reviews FROM anon;
GRANT SELECT (id, product_id, product_name, order_id, customer_name, rating, comment,
              photo_url, verified, admin_reply, active, created_at, updated_at)
  ON public.reviews TO anon;

-- 4. Branches: hide financial / manager identifiers from anonymous visitors
DROP POLICY IF EXISTS "branches public read" ON public.branches;
REVOKE SELECT ON public.branches FROM anon;
GRANT SELECT (id, name, address, phone, lat, lng, open_time, close_time,
              delivery_radius_km, is_active, sort_order, slug, code, is_default,
              min_order_amount, created_at, updated_at)
  ON public.branches TO anon;

-- 5. Store settings: public-safe view, sensitive columns revoked from anon
DO $$
DECLARE
  cols text;
  excluded text[] := ARRAY[
    'upi_id','gstin','gst_number','gst_legal_name','fssai_number','fssai_license_no',
    'fcm_project_id','sender_email','payment_gateway','google_site_verification',
    'bing_site_verification','custom_domain','store_map_link'
  ];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'store_settings'
    AND NOT (column_name = ANY (excluded));

  EXECUTE format('CREATE OR REPLACE VIEW public.store_settings_public AS SELECT %s FROM public.store_settings', cols);
  EXECUTE 'ALTER VIEW public.store_settings_public SET (security_invoker = off)';
  EXECUTE 'REVOKE SELECT ON public.store_settings FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.store_settings TO anon', cols);
  EXECUTE 'GRANT SELECT ON public.store_settings_public TO anon, authenticated';
END $$;

-- 6. Wallet: atomic, server-enforced balance operations
CREATE OR REPLACE FUNCTION public.ensure_my_wallet()
RETURNS public.customer_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  w public.customer_wallets;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  SELECT * INTO w FROM public.customer_wallets WHERE user_id = uid;
  IF FOUND THEN
    RETURN w;
  END IF;

  INSERT INTO public.customer_wallets (user_id, balance, referral_code, total_earned, total_redeemed)
  VALUES (uid, 0, 'FNF-' || upper(substr(md5(uid::text || clock_timestamp()::text), 1, 5)), 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO w FROM public.customer_wallets WHERE user_id = uid;
  RETURN w;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_wallet_balance(p_amount numeric, p_order_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_balance numeric;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sign in required');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  UPDATE public.customer_wallets
     SET balance = balance - p_amount,
         total_redeemed = COALESCE(total_redeemed, 0) + p_amount,
         updated_at = now()
   WHERE user_id = uid AND balance >= p_amount
   RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient wallet balance');
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, order_id)
  VALUES (uid, -p_amount, 'order_redemption', 'Wallet redeemed at checkout', p_order_id);

  RETURN jsonb_build_object('success', true, 'balance', new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_wallet_cashback(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  o record;
  pct numeric := 0;
  amt numeric := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sign in required');
  END IF;

  SELECT id, user_id, total INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.wallet_transactions
              WHERE order_id = p_order_id AND type = 'cashback') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cashback already credited');
  END IF;

  SELECT COALESCE(cashback_percent, 0) INTO pct FROM public.store_settings LIMIT 1;
  amt := round(COALESCE(o.total, 0) * COALESCE(pct, 0) / 100);
  IF amt <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No cashback applicable');
  END IF;

  PERFORM public.ensure_my_wallet();

  UPDATE public.customer_wallets
     SET balance = balance + amt,
         total_earned = COALESCE(total_earned, 0) + amt,
         updated_at = now()
   WHERE user_id = uid;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, order_id)
  VALUES (uid, amt, 'cashback', 'Cashback on order', p_order_id);

  RETURN jsonb_build_object('success', true, 'amount', amt);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_my_wallet() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_wallet_balance(numeric, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_cashback(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_wallet() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_wallet_balance(numeric, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_wallet_cashback(uuid) TO authenticated, service_role;

-- 7. Orders: block non-staff from editing pricing / payment fields after creation
CREATE OR REPLACE FUNCTION public.protect_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  NEW.items := OLD.items;
  NEW.subtotal := OLD.subtotal;
  NEW.discount := OLD.discount;
  NEW.delivery_fee := OLD.delivery_fee;
  NEW.gst_amount := OLD.gst_amount;
  NEW.additional_charges := OLD.additional_charges;
  NEW.total := OLD.total;
  NEW.payment_status := OLD.payment_status;
  NEW.upi_paid := OLD.upi_paid;
  NEW.refund_amount := OLD.refund_amount;
  NEW.status := OLD.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_protect_financials ON public.orders;
CREATE TRIGGER orders_protect_financials
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_order_financials();