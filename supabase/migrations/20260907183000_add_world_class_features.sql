-- Add coordinates and distance billing to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS shop_lat numeric,
ADD COLUMN IF NOT EXISTS shop_lng numeric,
ADD COLUMN IF NOT EXISTS base_delivery_fee numeric NOT NULL DEFAULT 40,
ADD COLUMN IF NOT EXISTS per_km_charge numeric NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_delivery_radius_km numeric NOT NULL DEFAULT 20;

-- Add smart GST to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS gst_included boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS gst_percent numeric NOT NULL DEFAULT 0;

-- Add product request table
CREATE TABLE IF NOT EXISTS public.product_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text,
  customer_phone text,
  product_name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
