-- ==============================================================================
-- Migration: Multi-Vertical Business Model (Seafood / Chicken & Poultry / All-Meat)
-- Allows the store owner to toggle between:
-- 1. 'seafood': Fish & Seafood Hub
-- 2. 'chicken_meat': Farm Fresh Chicken & Meat Hub
-- 3. 'all_meat': Multi-Meat Superstore (Fish, Chicken, Mutton & Seafood)
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='business_vertical') THEN
    ALTER TABLE public.store_settings ADD COLUMN business_vertical VARCHAR(50) NOT NULL DEFAULT 'seafood';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='vertical_tagline') THEN
    ALTER TABLE public.store_settings ADD COLUMN vertical_tagline TEXT DEFAULT 'Daily Fresh Day Catch & Pure Cuts';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='vertical_banner_url') THEN
    ALTER TABLE public.store_settings ADD COLUMN vertical_banner_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='vertical_badge_text') THEN
    ALTER TABLE public.store_settings ADD COLUMN vertical_badge_text TEXT DEFAULT '100% Fresh Daily Harvest';
  END IF;
END $$;
