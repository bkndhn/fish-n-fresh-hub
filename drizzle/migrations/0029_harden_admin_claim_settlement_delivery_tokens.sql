REVOKE EXECUTE ON FUNCTION public.claim_super_admin_role() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_table_active_orders(p_table text)
 RETURNS TABLE(id uuid, order_number text, status text, total numeric, items jsonb, table_number text, round_number integer, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.id, o.order_number, o.status, o.total, o.items, o.table_number, COALESCE(o.round_number,1), o.created_at
  FROM public.orders o
  WHERE public.is_team_member()
    AND (o.table_number = p_table OR o.table_number = 'Table ' || p_table)
    AND o.fulfillment_type = 'dine_in'
    AND o.status NOT IN ('delivered','completed','cancelled')
  ORDER BY o.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_table_active_orders(p_table text, p_session_id text)
 RETURNS TABLE(id uuid, order_number text, status text, total numeric, items jsonb, table_number text, round_number integer, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.id, o.order_number, o.status, o.total, o.items, o.table_number, COALESCE(o.round_number,1), o.created_at
  FROM public.orders o
  WHERE p_session_id IS NOT NULL AND length(p_session_id) >= 16
    AND o.session_id = p_session_id
    AND (o.table_number = p_table OR o.table_number = 'Table ' || p_table)
    AND o.fulfillment_type = 'dine_in'
    AND o.status NOT IN ('delivered','completed','cancelled')
  ORDER BY o.created_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_table_active_orders(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.settle_driver_cod_orders_atomic(p_settlement_number text, p_driver_name text, p_driver_phone text, p_driver_id uuid, p_order_ids uuid[], p_amount_collected numeric, p_amount_settled numeric, p_balance_remaining numeric, p_settled_by_name text, p_settled_by_id uuid, p_payment_mode text, p_notes text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_locked_count integer; v_expected numeric; v_rec record;
BEGIN
  IF NOT (public.is_admin_or_super() OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier')) THEN
    RAISE EXCEPTION 'Forbidden: only managers or cashiers can settle driver cash';
  END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids,1) IS NULL THEN RAISE EXCEPTION 'No orders selected'; END IF;
  IF p_amount_collected < 0 OR p_amount_settled < 0 OR p_amount_settled > p_amount_collected THEN
    RAISE EXCEPTION 'Invalid settlement amounts';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO v_locked_count, v_expected
  FROM (SELECT total FROM public.orders
        WHERE id = ANY(p_order_ids) AND (cod_settled IS FALSE OR cod_settled IS NULL)
          AND payment_method = 'cod' AND status = 'delivered'
          AND (p_driver_id IS NULL OR driver_id = p_driver_id)
        FOR UPDATE) s;

  IF v_locked_count != array_length(p_order_ids,1) THEN
    RAISE EXCEPTION 'ERR_ALREADY_SETTLED: One or more selected orders are already settled, not delivered COD, or belong to another driver.';
  END IF;
  IF abs(p_amount_collected - v_expected) > 0.01 THEN
    RAISE EXCEPTION 'Collected amount must equal the selected orders total (%)', v_expected;
  END IF;

  INSERT INTO public.driver_cash_settlements (settlement_number, driver_name, driver_phone, driver_id, amount_collected, amount_settled, balance_remaining, orders_count, order_ids, settled_by_name, settled_by_id, payment_mode, notes, settled_at)
  VALUES (p_settlement_number, p_driver_name, p_driver_phone, p_driver_id, v_expected, p_amount_settled, v_expected - p_amount_settled, array_length(p_order_ids,1), p_order_ids, p_settled_by_name, auth.uid(), p_payment_mode, p_notes, now())
  RETURNING * INTO v_rec;

  UPDATE public.orders SET cod_settled = true, settlement_id = v_rec.id, settled_at = now() WHERE id = ANY(p_order_ids);
  RETURN to_jsonb(v_rec);
END; $function$;

-- Customers can no longer edit their delivery code once created
DROP POLICY IF EXISTS "Customer can update delivery pin" ON public.order_delivery_pins;

CREATE OR REPLACE FUNCTION public.verify_and_deliver_order(p_order_id uuid, p_entered_pin text, p_is_admin_override boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pin_rec RECORD; v_order_rec RECORD; v_clean_pin TEXT;
BEGIN
  IF NOT public.is_team_member() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: only drivers or staff can complete deliveries');
  END IF;
  v_clean_pin := TRIM(COALESCE(p_entered_pin, ''));
  SELECT id, status, driver_id INTO v_order_rec FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Order not found'); END IF;
  IF v_order_rec.status = 'delivered' THEN RETURN jsonb_build_object('success', false, 'message', 'Order has already been marked delivered'); END IF;
  IF v_order_rec.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'message', 'Cannot deliver a cancelled order'); END IF;

  IF p_is_admin_override THEN
    IF NOT public.is_admin_or_super() THEN
      RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only store administrators can perform an emergency bypass');
    END IF;
    IF p_override_reason IS NULL OR LENGTH(TRIM(p_override_reason)) < 4 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Please provide a valid reason for emergency bypass');
    END IF;
    UPDATE public.order_delivery_pins SET verified_at = now(), verified_by = auth.uid() WHERE order_id = p_order_id;
    UPDATE public.orders SET status='delivered', delivered_at=now(),
      delivery_note = COALESCE(delivery_note || ' | ', '') || 'ADMIN BYPASS: ' || p_override_reason,
      payment_status = CASE WHEN payment_method='cod' THEN 'paid' ELSE payment_status END
    WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'message', 'Emergency bypass recorded. Order marked delivered.');
  END IF;

  SELECT * INTO v_pin_rec FROM public.order_delivery_pins WHERE order_id = p_order_id;
  IF NOT FOUND THEN
    IF NOT (public.is_admin_or_super() OR public.has_role(auth.uid(),'manager')
            OR (v_order_rec.driver_id IS NOT NULL AND v_order_rec.driver_id = auth.uid())) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Only the assigned driver or a manager can deliver this order');
    END IF;
    UPDATE public.orders SET status='delivered', delivered_at=now(),
      payment_status = CASE WHEN payment_method='cod' THEN 'paid' ELSE payment_status END
    WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'message', 'Order delivered successfully (legacy order without PIN).');
  END IF;

  IF v_pin_rec.attempts >= v_pin_rec.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'message', 'PIN locked: 5 incorrect attempts reached. Order locked for security. Ask store manager for admin verification.');
  END IF;

  IF v_clean_pin = v_pin_rec.pin_code THEN
    UPDATE public.order_delivery_pins SET verified_at = now(), verified_by = auth.uid() WHERE order_id = p_order_id;
    UPDATE public.orders SET status='delivered', delivered_at=now(),
      payment_status = CASE WHEN payment_method='cod' THEN 'paid' ELSE payment_status END
    WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'message', 'Delivery PIN verified! Package handed over successfully.');
  ELSE
    UPDATE public.order_delivery_pins SET attempts = attempts + 1 WHERE order_id = p_order_id;
    RETURN jsonb_build_object('success', false, 'message', 'Incorrect PIN! ' || (v_pin_rec.max_attempts - v_pin_rec.attempts - 1) || ' attempt(s) remaining. Ask customer for the 4-digit PIN on their live tracking screen.');
  END IF;
END; $function$;

-- Push tokens: a user may only register a staff-side role they actually hold
CREATE OR REPLACE FUNCTION public.enforce_fcm_token_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('service_role','postgres','supabase_admin') THEN RETURN NEW; END IF;
  IF NEW.role IS NULL OR NEW.role IN ('customer','user') THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL OR NEW.user_id <> auth.uid() THEN
    NEW.role := 'customer'; RETURN NEW;
  END IF;
  IF NEW.role IN ('admin','staff') AND NOT public.is_staff() AND NOT public.is_admin_or_super() THEN
    NEW.role := 'customer';
  ELSIF NEW.role = 'driver' AND NOT public.has_role(auth.uid(),'driver') THEN
    NEW.role := 'customer';
  ELSIF NEW.role NOT IN ('admin','staff','driver') AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = NEW.role) THEN
    NEW.role := 'customer';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enforce_fcm_token_role ON public.fcm_tokens;
CREATE TRIGGER trg_enforce_fcm_token_role BEFORE INSERT OR UPDATE ON public.fcm_tokens
FOR EACH ROW EXECUTE FUNCTION public.enforce_fcm_token_role();