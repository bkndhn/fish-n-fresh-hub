ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS complaint text;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS complaint_window_hours numeric NOT NULL DEFAULT 24;
