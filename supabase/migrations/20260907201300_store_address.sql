ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS store_address text,
ADD COLUMN IF NOT EXISTS store_map_link text;
