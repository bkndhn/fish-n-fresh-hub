-- 1. Only admins/managers/staff may auto-assign drivers
CREATE OR REPLACE FUNCTION public.guard_auto_assign_caller()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('admin','super_admin','manager','staff'));
$$;

DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.auto_assign_nearest_driver(uuid)'::regprocedure) INTO src;
  IF position('guard_auto_assign_caller' in src) = 0 THEN
    src := regexp_replace(src, 'BEGIN', E'BEGIN\n  IF auth.uid() IS NOT NULL AND NOT public.guard_auto_assign_caller() THEN\n    RETURN jsonb_build_object(''success'', false, ''error'', ''Not allowed'');\n  END IF;', '');
    EXECUTE src;
  END IF;
END $do$;
REVOKE EXECUTE ON FUNCTION public.auto_assign_nearest_driver(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.auto_assign_nearest_driver(uuid) TO authenticated;

-- 2. Recurring order prices are always server-calculated for non-staff
CREATE OR REPLACE FUNCTION public.enforce_subscription_pricing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_price numeric;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_or_super() OR public.is_staff() THEN
    RETURN NEW;
  END IF;
  SELECT price INTO v_price FROM public.products WHERE id = NEW.product_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.discount_percent := OLD.discount_percent;
  ELSE
    NEW.discount_percent := LEAST(GREATEST(COALESCE(NEW.discount_percent,5),0),5);
  END IF;
  NEW.quantity := GREATEST(COALESCE(NEW.quantity,1), 0.1);
  NEW.price_per_unit := v_price;
  NEW.total_price := round(v_price * NEW.quantity * (1 - NEW.discount_percent/100.0), 2);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_subscription_pricing ON public.customer_subscriptions;
CREATE TRIGGER trg_enforce_subscription_pricing BEFORE INSERT OR UPDATE ON public.customer_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_pricing();

-- 3. Table sessions must be long random ids
CREATE OR REPLACE FUNCTION public.get_table_active_orders(p_table text, p_session_id text)
RETURNS TABLE(id uuid, order_number text, status text, total numeric, items jsonb, table_number text, round_number integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT o.id, o.order_number, o.status, o.total, o.items, o.table_number, COALESCE(o.round_number,1), o.created_at
  FROM public.orders o
  WHERE p_session_id IS NOT NULL AND length(p_session_id) >= 40
    AND o.session_id = p_session_id
    AND (o.table_number = p_table OR o.table_number = 'Table ' || p_table)
    AND o.fulfillment_type = 'dine_in'
    AND o.status NOT IN ('delivered','completed','cancelled')
  ORDER BY o.created_at ASC;
$function$;

-- 4. Owner PIN + cancel/refund log
CREATE TABLE public.owner_pin (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  pin_hash text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.owner_pin TO service_role;
ALTER TABLE public.owner_pin ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bill_void_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_number text,
  action text NOT NULL CHECK (action IN ('cancel','refund')),
  amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  reason text NOT NULL,
  done_by uuid NOT NULL,
  done_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bill_void_logs TO authenticated;
GRANT ALL ON public.bill_void_logs TO service_role;
ALTER TABLE public.bill_void_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read void log" ON public.bill_void_logs FOR SELECT TO authenticated
  USING (public.is_admin_or_super() OR public.has_role(auth.uid(),'manager'));

CREATE OR REPLACE FUNCTION public.owner_pin_is_set()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.owner_pin);
$$;

CREATE OR REPLACE FUNCTION public.set_owner_pin(p_new_pin text, p_old_pin text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_hash text;
BEGIN
  IF NOT public.is_admin_or_super() THEN RAISE EXCEPTION 'Only the owner/admin can set the PIN'; END IF;
  IF p_new_pin !~ '^[0-9]{4,8}$' THEN RAISE EXCEPTION 'PIN must be 4 to 8 digits'; END IF;
  SELECT pin_hash INTO v_hash FROM public.owner_pin;
  IF v_hash IS NOT NULL AND (p_old_pin IS NULL OR crypt(p_old_pin, v_hash) <> v_hash) THEN
    RAISE EXCEPTION 'Current PIN is wrong';
  END IF;
  INSERT INTO public.owner_pin(id, pin_hash, updated_by, updated_at)
  VALUES (true, crypt(p_new_pin, gen_salt('bf')), auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, updated_by = EXCLUDED.updated_by, updated_at = now();
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.void_bill_with_pin(p_order_id uuid, p_pin text, p_action text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_hash text; v_order public.orders%ROWTYPE; v_name text; v_recent int;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
     AND role IN ('admin','super_admin','manager','staff','cashier')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p_action NOT IN ('cancel','refund') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  IF length(trim(coalesce(p_reason,''))) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  SELECT pin_hash INTO v_hash FROM public.owner_pin;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'Owner PIN is not set yet. Ask the owner to set it.'; END IF;
  SELECT count(*) INTO v_recent FROM public.platform_audit_logs
   WHERE actor_id = auth.uid() AND action = 'owner_pin_failed' AND created_at > now() - interval '15 minutes';
  IF v_recent >= 5 THEN RAISE EXCEPTION 'Too many wrong PINs. Try again in 15 minutes.'; END IF;
  IF crypt(coalesce(p_pin,''), v_hash) <> v_hash THEN
    INSERT INTO public.platform_audit_logs(actor_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'owner_pin_failed', 'order', p_order_id::text, jsonb_build_object('action', p_action));
    RETURN jsonb_build_object('success', false, 'error', 'Wrong owner PIN');
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'This bill is already cancelled'; END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.orders SET status = 'cancelled', cancel_reason = trim(p_reason), cancelled_by = auth.uid(),
    payment_status = CASE WHEN p_action = 'refund' THEN 'refunded' ELSE payment_status END,
    refund_amount = CASE WHEN p_action = 'refund' THEN total ELSE refund_amount END,
    refunded_at = CASE WHEN p_action = 'refund' THEN now() ELSE refunded_at END,
    updated_at = now()
  WHERE id = p_order_id;
  PERFORM public.restore_order_stock_atomic(p_order_id);

  INSERT INTO public.bill_void_logs(order_id, order_number, action, amount, payment_method, reason, done_by, done_by_name)
  VALUES (p_order_id, v_order.order_number, p_action, COALESCE(v_order.total,0), v_order.payment_method, trim(p_reason), auth.uid(), v_name);
  RETURN jsonb_build_object('success', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.set_owner_pin(text,text), public.void_bill_with_pin(uuid,text,text,text), public.owner_pin_is_set() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_owner_pin(text,text), public.void_bill_with_pin(uuid,text,text,text), public.owner_pin_is_set() TO authenticated;