-- Add Payment and Review settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS google_review_link text,
ADD COLUMN IF NOT EXISTS payment_gateway text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS gateway_api_key text,
ADD COLUMN IF NOT EXISTS gateway_secret_key text,
ADD COLUMN IF NOT EXISTS require_online_payment boolean DEFAULT false;

-- Add Banners table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  link text,
  cta text,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime on Banners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'banners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE banners;
  END IF;
END $$;
