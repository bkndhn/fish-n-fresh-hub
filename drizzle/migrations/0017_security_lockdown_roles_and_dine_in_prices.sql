-- 1. Stop anyone signed in from making themselves admin: claim only works when the shop has no admin yet.
CREATE OR REPLACE FUNCTION public.claim_super_admin_role()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sign in first.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin')) THEN
    BEGIN
      INSERT INTO public.platform_audit_logs (actor_id, actor_role, action, target_type, target_id, details)
      VALUES (v_user_id, 'unknown', 'BLOCKED_ADMIN_CLAIM', 'user_roles', v_user_id::text, jsonb_build_object('at', now()));
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN jsonb_build_object('success', false, 'message', 'An administrator already exists. Ask them to grant access.');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id,'admin'),(v_user_id,'super_admin') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true, 'message', 'Administrator access granted.');
END; $function$;

-- 2. Roles can only be changed by an admin (or the server); removing roles too.
CREATE OR REPLACE FUNCTION public.prevent_role_tampering()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(NEW.role, OLD.role) IN ('admin','super_admin') THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Access denied: only a super administrator can change admin access.';
    END IF;
  END IF;
  IF NOT public.is_admin_or_super() THEN
    RAISE EXCEPTION 'Access denied: only administrators can change roles.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$;
DROP TRIGGER IF EXISTS trg_prevent_role_tampering_del ON public.user_roles;
CREATE TRIGGER trg_prevent_role_tampering_del BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_tampering();

-- 3. Table QR orders: prices come from the product list, never from the phone.
CREATE OR REPLACE FUNCTION public.place_dine_in_order(p_table text, p_customer_name text, p_customer_phone text, p_notes text, p_items jsonb, p_round integer DEFAULT 1, p_session_id text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid; v_order_number text; v_total numeric := 0; v_item jsonb;
  v_qty numeric; v_prod record; v_items jsonb := '[]'::jsonb; v_result jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN RAISE EXCEPTION 'Too many items'; END IF;
  IF p_table IS NULL OR length(p_table) > 10 THEN RAISE EXCEPTION 'Invalid table'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'qty')::numeric, 0);
    IF v_qty <= 0 OR v_qty > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, price, is_available INTO v_prod FROM public.products
      WHERE id = NULLIF(COALESCE(v_item->>'product_id', v_item->>'id'), '')::uuid;
    IF NOT FOUND OR v_prod.is_available IS NOT TRUE THEN RAISE EXCEPTION 'Item not available'; END IF;
    v_total := v_total + v_qty * v_prod.price;
    v_items := v_items || jsonb_build_array((v_item - 'price' - 'name') ||
      jsonb_build_object('product_id', v_prod.id, 'name', v_prod.name, 'price', v_prod.price, 'qty', v_qty));
  END LOOP;

  v_order_number := 'DINE-T' || p_table || '-R' || COALESCE(p_round, 1) || '-' || LPAD((FLOOR(RANDOM()*9000)+1000)::text, 4, '0');
  INSERT INTO public.orders (order_number, status, fulfillment_type, table_number, customer_name, customer_phone,
    customer_address, subtotal, total, delivery_fee, discount, payment_method, payment_status, notes, items, round_number, session_id)
  VALUES (v_order_number, 'pending', 'dine_in', p_table,
    left(COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Table ' || p_table || ' Diner'), 80),
    COALESCE(NULLIF(regexp_replace(COALESCE(p_customer_phone,''), '\D', '', 'g'), ''), '9999999999'),
    'Table ' || p_table || ' (Dine-In)', v_total, v_total, 0, 0, 'pay_at_counter', 'pending',
    left(COALESCE(p_notes, 'Round ' || COALESCE(p_round, 1)), 500), v_items, COALESCE(p_round, 1), p_session_id)
  RETURNING id INTO v_order_id;
  SELECT to_jsonb(o) INTO v_result FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_result;
END; $function$;

-- 4. Counter staff (cashier/manager) count as staff for POS bills; drivers can no longer edit bill amounts.
CREATE OR REPLACE FUNCTION public.protect_order_financials()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
             AND role IN ('admin','super_admin','manager','staff','cashier')) THEN
    RETURN NEW;
  END IF;
  NEW.items := OLD.items; NEW.subtotal := OLD.subtotal; NEW.discount := OLD.discount;
  NEW.delivery_fee := OLD.delivery_fee; NEW.gst_amount := OLD.gst_amount;
  NEW.additional_charges := OLD.additional_charges; NEW.total := OLD.total;
  NEW.refund_amount := OLD.refund_amount;
  IF NOT public.is_staff() THEN
    NEW.payment_status := OLD.payment_status; NEW.upi_paid := OLD.upi_paid; NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $function$;