-- ==============================================================================
-- Migration: One-Time Delivery PIN (Anti-Theft & Anti-Scam Verification)
-- Description: Creates order_delivery_pins table with strict Row Level Security (RLS)
--              visible ONLY to the purchasing customer, and a secure RPC function
--              verify_and_deliver_order for drivers, staff, and admins to verify PIN.
-- ==============================================================================

-- 1. Create order_delivery_pins table
CREATE TABLE IF NOT EXISTS public.order_delivery_pins (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id),
  pin_code VARCHAR(6) NOT NULL,
  pin_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_delivery_pins ENABLE ROW LEVEL SECURITY;

-- 2. Strict RLS Policies:
-- ONLY the customer who placed the order can view the PIN code!
-- Admins, staff, and drivers CANNOT query or view the PIN plaintext.
DROP POLICY IF EXISTS "Customer can view their own order delivery pin" ON public.order_delivery_pins;
CREATE POLICY "Customer can view their own order delivery pin"
  ON public.order_delivery_pins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

-- Customer can insert their delivery pin during checkout
DROP POLICY IF EXISTS "Customer can insert delivery pin" ON public.order_delivery_pins;
CREATE POLICY "Customer can insert delivery pin"
  ON public.order_delivery_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

-- Customer or service can update pin attempts
DROP POLICY IF EXISTS "Customer can update delivery pin" ON public.order_delivery_pins;
CREATE POLICY "Customer can update delivery pin"
  ON public.order_delivery_pins
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id);

-- 3. Automatic PIN Generator Trigger for Orders
-- Automatically provisions a 4-digit PIN for any newly inserted order
CREATE OR REPLACE FUNCTION public.fn_generate_order_delivery_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_random_pin TEXT;
  v_hash TEXT;
  v_cust_id UUID;
BEGIN
  -- Determine customer UUID
  v_cust_id := COALESCE(NEW.user_id, NEW.created_by, auth.uid());

  -- If customer exists, generate 4-digit random PIN (1000-9999)
  IF v_cust_id IS NOT NULL THEN
    v_random_pin := LPAD(FLOOR(1000 + random() * 9000)::TEXT, 4, '0');
    v_hash := encode(digest(v_random_pin, 'sha256'), 'hex');

    INSERT INTO public.order_delivery_pins (
      order_id,
      customer_id,
      pin_code,
      pin_hash,
      attempts,
      max_attempts
    )
    VALUES (
      NEW.id,
      v_cust_id,
      v_random_pin,
      v_hash,
      0,
      5
    )
    ON CONFLICT (order_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Prevent order insertion failure if pgcrypto is missing digest
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivery_pin ON public.orders;
CREATE TRIGGER trg_order_delivery_pin
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_generate_order_delivery_pin();

-- 4. Secure RPC Function: verify_and_deliver_order
-- Used by drivers, delivery crew, store counter staff, and admins.
-- Checks attempts, verifies the PIN, marks order as delivered atomically.
CREATE OR REPLACE FUNCTION public.verify_and_deliver_order(
  p_order_id UUID,
  p_entered_pin TEXT,
  p_is_admin_override BOOLEAN DEFAULT FALSE,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pin_rec RECORD;
  v_order_rec RECORD;
  v_is_admin BOOLEAN := FALSE;
  v_clean_pin TEXT;
BEGIN
  v_clean_pin := TRIM(COALESCE(p_entered_pin, ''));

  -- 1. Fetch order details
  SELECT id, status, fulfillment_type, payment_method, payment_status, total
  INTO v_order_rec
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_order_rec.status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order has already been marked delivered');
  END IF;

  IF v_order_rec.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot deliver a cancelled order');
  END IF;

  -- 2. Handle Admin Emergency Override
  IF p_is_admin_override THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only store administrators can perform an emergency bypass');
    END IF;

    IF p_override_reason IS NULL OR LENGTH(TRIM(p_override_reason)) < 4 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Please provide a valid reason for emergency bypass');
    END IF;

    UPDATE public.order_delivery_pins
    SET verified_at = now(),
        verified_by = auth.uid()
    WHERE order_id = p_order_id;

    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = now(),
        delivery_note = COALESCE(delivery_note || ' | ', '') || 'ADMIN BYPASS: ' || p_override_reason,
        payment_status = CASE WHEN payment_method = 'cod' THEN 'paid' ELSE payment_status END
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Emergency bypass recorded. Order marked delivered.');
  END IF;

  -- 3. Fetch delivery PIN record
  SELECT *
  INTO v_pin_rec
  FROM public.order_delivery_pins
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    -- If no pin record exists for this legacy order, allow direct delivery
    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = now(),
        payment_status = CASE WHEN payment_method = 'cod' THEN 'paid' ELSE payment_status END
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Order delivered successfully (legacy order without PIN).');
  END IF;

  -- 4. Check brute-force attempts
  IF v_pin_rec.attempts >= v_pin_rec.max_attempts THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'PIN locked: 5 incorrect attempts reached. Order locked for security. Ask store manager for admin verification.'
    );
  END IF;

  -- 5. Compare PIN
  IF v_clean_pin = v_pin_rec.pin_code THEN
    -- Mark PIN verified
    UPDATE public.order_delivery_pins
    SET verified_at = now(),
        verified_by = auth.uid()
    WHERE order_id = p_order_id;

    -- Update Order status to delivered
    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = now(),
        payment_status = CASE WHEN payment_method = 'cod' THEN 'paid' ELSE payment_status END
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Delivery PIN verified! Fresh seafood package handed over successfully.'
    );
  ELSE
    -- Increment failed attempt counter
    UPDATE public.order_delivery_pins
    SET attempts = attempts + 1
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Incorrect PIN! ' || (v_pin_rec.max_attempts - v_pin_rec.attempts - 1) || ' attempt(s) remaining. Ask customer for the 4-digit PIN on their live tracking screen.'
    );
  END IF;
END;
$$;
