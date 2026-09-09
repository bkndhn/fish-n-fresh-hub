-- ==============================================================================
-- MIGRATION: World-Class SEO, Multi-Tenant Custom Domains & Webmaster Analytics
-- ==============================================================================

-- 1. Update Schema Version
INSERT INTO public.schema_version (version, migration_hash, description)
VALUES ('2.3.0', '20260909200000', 'SEO engine: dynamic custom domains, Schema.org metadata, webmaster verifications, and analytics tags');

-- 2. Add SEO & Domain Fields to store_settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS custom_domain TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS seo_title_template TEXT DEFAULT '%s | {{store_name}}',
ADD COLUMN IF NOT EXISTS seo_default_description TEXT DEFAULT 'Fresh Seafood & Premium Meat delivered in 35 minutes. 100% chemical-free, lab-tested quality, express ice-box delivery.',
ADD COLUMN IF NOT EXISTS seo_keywords TEXT DEFAULT 'fresh fish, seer fish, vanjaram, prawns, crab, mutton, chicken, seafood delivery, chennai fish',
ADD COLUMN IF NOT EXISTS seo_og_image TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS google_site_verification TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bing_site_verification TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT DEFAULT NULL;

-- 3. Ensure indexing on product slug/id for super-fast XML sitemap generation
CREATE INDEX IF NOT EXISTS idx_products_is_available_updated ON public.products (is_available, updated_at DESC);
