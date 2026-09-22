ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS sales_mode text NOT NULL DEFAULT 'retail';

ALTER TABLE public.store_settings
  ADD CONSTRAINT store_settings_sales_mode_check
  CHECK (sales_mode IN ('retail', 'wholesale', 'both'));

COMMENT ON COLUMN public.store_settings.sales_mode IS 'retail = retail customers only, wholesale = trade buyers only, both = hybrid storefront';