-- Add theme_color to settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS theme_color text;

-- Create customer suspensions table
CREATE TABLE IF NOT EXISTS public.customer_suspensions (
  phone text PRIMARY KEY,
  reason text,
  suspended_at timestamptz NOT NULL DEFAULT now()
);

-- Enable realtime for customer_suspensions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_suspensions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_suspensions;
  END IF;
END $$;
