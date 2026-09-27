-- ==============================================================================
-- PostgREST Data API Storefront Permissions & Access Grants
-- ==============================================================================
-- This script ensures the Supabase PostgREST Data API allows both anonymous
-- storefront visitors ('anon') and logged-in customers ('authenticated') to
-- read essential public storefront catalog, branch, and configuration tables.
-- Run this in your Supabase SQL Editor if any public storefront queries encounter
-- permission errors or empty results.
-- ==============================================================================

-- 1. Ensure schema usage is granted
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant table-level SELECT permissions on public storefront tables
GRANT SELECT ON TABLE public.store_settings TO anon, authenticated;
GRANT SELECT ON TABLE public.products TO anon, authenticated;
GRANT SELECT ON TABLE public.categories TO anon, authenticated;
GRANT SELECT ON TABLE public.branches TO anon, authenticated;
GRANT SELECT ON TABLE public.banners TO anon, authenticated;
GRANT SELECT ON TABLE public.trust_badges TO anon, authenticated;
GRANT SELECT ON TABLE public.promotions TO anon, authenticated;

-- 3. Ensure Row Level Security (RLS) permissive SELECT policies exist for public storefront data

-- Store Settings: Public read
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_settings_public_read" ON public.store_settings;
CREATE POLICY "store_settings_public_read"
    ON public.store_settings FOR SELECT
    TO anon, authenticated
    USING (true);

-- Products: Public read
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read"
    ON public.products FOR SELECT
    TO anon, authenticated
    USING (true);

-- Categories: Public read
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (true);

-- Branches: Public read
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches_public_read" ON public.branches;
CREATE POLICY "branches_public_read"
    ON public.branches FOR SELECT
    TO anon, authenticated
    USING (true);

-- Banners: Public read
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "banners_public_read" ON public.banners;
CREATE POLICY "banners_public_read"
    ON public.banners FOR SELECT
    TO anon, authenticated
    USING (true);

-- Trust Badges: Public read
ALTER TABLE public.trust_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trust_badges_public_read" ON public.trust_badges;
CREATE POLICY "trust_badges_public_read"
    ON public.trust_badges FOR SELECT
    TO anon, authenticated
    USING (true);

-- Promotions: Public read
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promotions_public_read" ON public.promotions;
CREATE POLICY "promotions_public_read"
    ON public.promotions FOR SELECT
    TO anon, authenticated
    USING (true);
