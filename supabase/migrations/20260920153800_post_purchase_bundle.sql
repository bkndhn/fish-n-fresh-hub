-- 1. Store Settings: Global Returns Toggle
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS returns_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Products: Return Policy
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_window_days INTEGER NOT NULL DEFAULT 0;

-- 3. Orders: Courier Tracking & RTO
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_partner TEXT,
  ADD COLUMN IF NOT EXISTS awb_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS transit_log JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_rto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rto_reason TEXT;

-- 4. Orders: Returns & Refunds
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'none' CHECK (return_status IN ('none', 'requested', 'approved', 'rejected', 'returned')),
  ADD COLUMN IF NOT EXISTS return_reason TEXT,
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none' CHECK (refund_status IN ('none', 'pending', 'processed', 'failed')),
  ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMPTZ;

-- 5. Analytics View for Courier Performance
CREATE OR REPLACE VIEW public.courier_performance_stats AS
SELECT
  courier_partner,
  COUNT(id) as total_shipments,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful_deliveries,
  COUNT(CASE WHEN is_rto = true THEN 1 END) as rto_count,
  AVG(EXTRACT(EPOCH FROM (delivered_at - shipped_at)) / 3600) as avg_delivery_hours
FROM public.orders
WHERE courier_partner IS NOT NULL AND shipped_at IS NOT NULL
GROUP BY courier_partner;
