-- ==============================================================================
-- Migration: Universal Retail Commerce Engine (Electronics, Fashion, Grocery & Mart)
-- Description: Adds dynamic specifications, brand, model, warranty, IMEI/serial flags,
--              aisle/shelf picking locations, and size/color variant arrays.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Brand & Model
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand') THEN
    ALTER TABLE public.products ADD COLUMN brand TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='model_number') THEN
    ALTER TABLE public.products ADD COLUMN model_number TEXT;
  END IF;

  -- 2. Warranty Management
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='warranty_period_months') THEN
    ALTER TABLE public.products ADD COLUMN warranty_period_months INTEGER DEFAULT 0;
  END IF;

  -- 3. Dynamic Technical & Material Specifications (JSONB)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='specifications') THEN
    ALTER TABLE public.products ADD COLUMN specifications JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- 4. Aisle / Shelf / Bin picking location
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='aisle_location') THEN
    ALTER TABLE public.products ADD COLUMN aisle_location TEXT;
  END IF;

  -- 5. 2D Size & Color Variant Matrix
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='variants') THEN
    ALTER TABLE public.products ADD COLUMN variants JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- 6. Mandatory IMEI / Serial tracking flag on POS & checkout
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='requires_serial') THEN
    ALTER TABLE public.products ADD COLUMN requires_serial BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Optimized indices for multi-retail filtering
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_aisle ON public.products(aisle_location) WHERE aisle_location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_requires_serial ON public.products(requires_serial) WHERE requires_serial = true;

COMMENT ON COLUMN public.products.specifications IS 'Dynamic key-values for electronics (RAM, Storage, Star Rating) or clothing (Fabric, Fit)';
COMMENT ON COLUMN public.products.variants IS 'Array of size/color matrix options with individual SKU, price, and inventory';
COMMENT ON COLUMN public.products.requires_serial IS 'When true, cashier or checkout must capture IMEI or Serial Number';
