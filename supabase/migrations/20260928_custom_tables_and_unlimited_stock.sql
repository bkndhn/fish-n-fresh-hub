-- Migration: Custom Restaurant Tables, Master QR Ordering Toggle & Unlimited Stock Engine
-- Date: 2026-09-28

-- 1. Extend store_settings table
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS table_ordering_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS table_ordering_offline_message text DEFAULT 'Table ordering is currently offline. Please call our steward or visit the counter.',
  ADD COLUMN IF NOT EXISTS restaurant_tables jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allow_unlimited_stock boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_out_of_stock_badges boolean DEFAULT false;

-- 2. Extend products table with per-item unlimited stock override
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unlimited_stock boolean DEFAULT false;

-- 3. Extend orders table with table_number
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_number text;

-- 3. Set default true for table_ordering_enabled if null
UPDATE public.store_settings
SET table_ordering_enabled = true
WHERE table_ordering_enabled IS NULL;

-- 4. Set default allow_unlimited_stock for hospitality/bakery verticals
UPDATE public.store_settings
SET allow_unlimited_stock = true
WHERE business_vertical IN ('restaurant_cafe', 'juice_shake_bar', 'bakery_cake')
  AND (allow_unlimited_stock IS NULL OR allow_unlimited_stock = false);
