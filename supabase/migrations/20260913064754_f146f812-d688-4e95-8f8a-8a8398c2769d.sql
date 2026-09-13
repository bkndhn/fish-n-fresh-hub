ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS firm_name text,
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold numeric,
  ADD COLUMN IF NOT EXISTS daily_atmosphere_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pos_split_payments jsonb,
  ADD COLUMN IF NOT EXISTS reprint_count integer NOT NULL DEFAULT 0;