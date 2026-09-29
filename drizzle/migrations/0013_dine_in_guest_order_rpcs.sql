-- Secure guest dine-in ordering without exposing the orders table to anon.

CREATE OR REPLACE FUNCTION public.get_table_active_orders(p_table text)
RETURNS TABLE (
  id uuid,
  order_number text,
  status text,
  total numeric,
  items jsonb,
  table_number text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.order_number, o.status, o.total, o.items, o.table_number, o.created_at
  FROM public.orders o
  WHERE o.fulfillment_type = 'dine_in'
    AND o.table_number = p_table
    AND o.status IN ('pending','confirmed','preparing','packed','ready')
  ORDER BY o.created_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.place_dine_in_order(
  p_table text,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_price numeric;
  v_name text;
  v_unit text;
  v_qty numeric;
  v_total numeric := 0;
  v_order public.orders%ROWTYPE;
  v_number text;
BEGIN
  IF p_table IS NULL OR length(trim(p_table)) = 0 THEN
    RAISE EXCEPTION 'Invalid table';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your table cart is empty.';
  END IF;
  IF jsonb_array_length(p_items) > 60 THEN
    RAISE EXCEPTION 'Too many items in one ticket.';
  END IF;

  SELECT COALESCE(s.table_ordering_enabled, true) INTO v_enabled
  FROM public.store_settings s LIMIT 1;
  IF v_enabled IS FALSE THEN
    RAISE EXCEPTION 'Table ordering is currently offline.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, LEAST(99, COALESCE((v_item->>'qty')::numeric, 1)));
    SELECT p.price, p.name, COALESCE(p.unit, 'portion')
      INTO v_price, v_name, v_unit
      FROM public.products p
     WHERE p.id = (v_item->>'product_id')::uuid
       AND COALESCE(p.is_active, true) = true;
    IF v_price IS NULL THEN
      RAISE EXCEPTION 'Item unavailable';
    END IF;
    v_total := v_total + (v_price * v_qty);
    v_items := v_items || jsonb_build_object(
      'product_id', v_item->>'product_id',
      'name', v_name || ' [' || upper(COALESCE(v_item->>'spice_level','medium')) || ']',
      'qty', v_qty,
      'unit', v_unit,
      'price', v_price,
      'total_price', v_price * v_qty,
      'spice_level', left(COALESCE(v_item->>'spice_level','medium'), 20),
      'cooking_instruction', left(COALESCE(v_item->>'cooking_instruction',''), 200)
    );
  END LOOP;

  v_number := 'DINE-T' || left(p_table, 8) || '-' || right(extract(epoch from now())::bigint::text, 5);

  INSERT INTO public.orders (
    order_number, status, fulfillment_type, table_number,
    customer_name, customer_phone, customer_address,
    total, subtotal, delivery_fee, discount,
    payment_method, payment_status, notes, items
  ) VALUES (
    v_number, 'pending', 'dine_in', left(p_table, 16),
    COALESCE(NULLIF(left(trim(p_customer_name), 60), ''), 'Table ' || p_table || ' Diner'),
    COALESCE(NULLIF(left(regexp_replace(COALESCE(p_customer_phone,''), '[^0-9+]', '', 'g'), 15), ''), '9999999999'),
    'Table ' || p_table || ' (Dine-In)',
    v_total, v_total, 0, 0,
    'pay_at_counter', 'pending',
    left(COALESCE(p_notes, 'Standard Chef Prep'), 400),
    v_items
  ) RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'total', v_order.total,
    'items', v_order.items,
    'table_number', v_order.table_number,
    'created_at', v_order.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_table_active_orders(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_dine_in_order(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_active_orders(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_dine_in_order(text, text, text, text, jsonb) TO anon, authenticated;
