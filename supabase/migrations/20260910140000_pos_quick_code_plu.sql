-- Migration: 20260910140000_pos_quick_code_plu.sql
-- Description: Add permanent PLU / Quick Code to products table for high-speed POS billing

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS pos_code INTEGER;

-- Create unique index on pos_code (ignoring nulls so draft items don't collide)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_pos_code 
ON public.products(pos_code) 
WHERE pos_code IS NOT NULL;

-- Automatically seed existing products with stable, sequential numbers (1, 2, 3...)
WITH ordered_products AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, name ASC) AS seq
  FROM public.products
  WHERE pos_code IS NULL
)
UPDATE public.products p
SET pos_code = op.seq
FROM ordered_products op
WHERE p.id = op.id;

-- Comment for schema documentation
COMMENT ON COLUMN public.products.pos_code IS 'Permanent, immutable Price Look-Up (PLU) short numeric code for in-store POS speed billing.';
