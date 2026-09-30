-- 1. Create table for diner service calls (waiter, bill, water, etc.)
CREATE TABLE IF NOT EXISTS public.table_service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('waiter_call', 'bill_request', 'water', 'cutlery', 'cleaning', 'custom')),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Grants for table_service_requests
GRANT SELECT, INSERT ON public.table_service_requests TO anon;
GRANT ALL ON public.table_service_requests TO authenticated;
GRANT ALL ON public.table_service_requests TO service_role;

-- 3. Enable RLS
ALTER TABLE public.table_service_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'table_service_requests' AND policyname = 'Allow public insert service requests'
  ) THEN
    CREATE POLICY "Allow public insert service requests"
    ON public.table_service_requests
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'table_service_requests' AND policyname = 'Allow public select service requests for active tables'
  ) THEN
    CREATE POLICY "Allow public select service requests for active tables"
    ON public.table_service_requests
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'table_service_requests' AND policyname = 'Staff can update service requests'
  ) THEN
    CREATE POLICY "Staff can update service requests"
    ON public.table_service_requests
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- 4. Enable Supabase Realtime replication on service requests and orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'table_service_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.table_service_requests;
  END IF;
END $$;

-- 5. Add round_number and session_id to orders if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'round_number') THEN
    ALTER TABLE public.orders ADD COLUMN round_number INT DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'session_id') THEN
    ALTER TABLE public.orders ADD COLUMN session_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'table_number') THEN
    ALTER TABLE public.orders ADD COLUMN table_number TEXT;
  END IF;
END $$;

-- 6. RPC: Place Dine-In Order with Multi-Round support (Bypasses guest anon order lock)
CREATE OR REPLACE FUNCTION public.place_dine_in_order(
    p_table TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_notes TEXT,
    p_items JSONB,
    p_round INT DEFAULT 1,
    p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_total NUMERIC := 0;
    v_item JSONB;
    v_qty INT;
    v_price NUMERIC;
    v_result JSONB;
    v_clean_phone TEXT;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;

    -- Calculate total from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_qty := (v_item->>'qty')::INT;
        v_price := (v_item->>'price')::NUMERIC;
        v_total := v_total + (v_qty * v_price);
    END LOOP;

    v_clean_phone := COALESCE(NULLIF(TRIM(p_customer_phone), ''), '9999999999');
    v_order_number := 'DINE-T' || p_table || '-R' || COALESCE(p_round, 1) || '-' || LPAD((FLOOR(RANDOM()*9000)+1000)::TEXT, 4, '0');

    INSERT INTO public.orders (
        order_number,
        status,
        fulfillment_type,
        table_number,
        customer_name,
        customer_phone,
        customer_address,
        subtotal,
        total,
        delivery_fee,
        discount,
        payment_method,
        payment_status,
        notes,
        items,
        round_number,
        session_id
    ) VALUES (
        v_order_number,
        'pending',
        'dine_in',
        p_table,
        COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Table ' || p_table || ' Diner'),
        v_clean_phone,
        'Table ' || p_table || ' (Dine-In)',
        v_total,
        v_total,
        0,
        0,
        'pay_at_counter',
        'pending',
        COALESCE(p_notes, 'Round ' || COALESCE(p_round, 1)),
        p_items,
        COALESCE(p_round, 1),
        p_session_id
    ) RETURNING id INTO v_order_id;

    SELECT to_jsonb(o) INTO v_result FROM public.orders o WHERE o.id = v_order_id;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.place_dine_in_order(TEXT, TEXT, TEXT, TEXT, JSONB, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_dine_in_order(TEXT, TEXT, TEXT, TEXT, JSONB, INT, TEXT) TO anon, authenticated, service_role;

-- 7. RPC: Fetch all active orders/rounds for a table
CREATE OR REPLACE FUNCTION public.get_table_active_orders(p_table TEXT)
RETURNS TABLE (
    id UUID,
    order_number TEXT,
    status TEXT,
    total NUMERIC,
    items JSONB,
    table_number TEXT,
    round_number INT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        o.id,
        o.order_number,
        o.status,
        o.total,
        o.items,
        o.table_number,
        COALESCE(o.round_number, 1) as round_number,
        o.created_at
    FROM public.orders o
    WHERE (o.table_number = p_table OR o.table_number = 'Table ' || p_table)
      AND o.fulfillment_type = 'dine_in'
      AND o.status NOT IN ('delivered', 'completed', 'cancelled')
    ORDER BY o.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_table_active_orders(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_active_orders(TEXT) TO anon, authenticated, service_role;
