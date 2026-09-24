-- 1. Add driver_lat/driver_lng to orders for live driver location
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_lat double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_lng double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_vehicle text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_phone text;

-- 2. Create driver_locations table for live GPS tracking
CREATE TABLE IF NOT EXISTS public.driver_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  is_online boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can read/write their own location
CREATE POLICY "driver_locations_own" ON public.driver_locations
  FOR ALL USING (auth.uid() = user_id);

-- Staff/admin can read all
CREATE POLICY "driver_locations_staff_read" ON public.driver_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin','manager','staff','driver')
    )
  );

-- Enable realtime for driver_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;

-- 3. Function: auto_assign_nearest_driver
-- Assigns the nearest online driver to an order
CREATE OR REPLACE FUNCTION public.auto_assign_nearest_driver(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_driver_id uuid;
  v_driver_name text;
  v_driver_phone text;
  v_result jsonb;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Find nearest online driver with no current active delivery
  SELECT
    dl.user_id,
    u.raw_user_meta_data->>'full_name' AS driver_name,
    u.phone AS driver_phone
  INTO v_driver_id, v_driver_name, v_driver_phone
  FROM driver_locations dl
  JOIN auth.users u ON u.id = dl.user_id
  WHERE dl.is_online = true
    AND v_order.location_lat IS NOT NULL
    AND v_order.location_lng IS NOT NULL
    -- Driver not already assigned to an active delivery
    AND NOT EXISTS (
      SELECT 1 FROM orders o2
      WHERE o2.driver_id = dl.user_id
        AND o2.status = 'out_for_delivery'
    )
  ORDER BY
    -- Haversine approx (degrees distance)
    SQRT(
      POWER(dl.lat - v_order.location_lat, 2) +
      POWER(dl.lng - v_order.location_lng, 2)
    ) ASC
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available drivers online');
  END IF;

  -- Assign the driver
  UPDATE orders
  SET
    driver_id = v_driver_id,
    driver_name = COALESCE(v_driver_name, 'Driver'),
    status = 'out_for_delivery',
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', v_driver_id,
    'driver_name', v_driver_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_nearest_driver TO authenticated;
