-- 20260912210000_gst_printer_whatsapp_customizations.sql
-- Store Customizations for Ordering Channel Mode, Master GST Control, and Thermal Printer Customizer

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS ordering_mode text NOT NULL DEFAULT 'standard';

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS whatsapp_order_phone text;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_gstin boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_fssai boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_address boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_phone boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_whatsapp boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_social boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_support boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_show_return_policy boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_custom_footer_message text;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_whatsapp_number text;

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS printer_social_handle text;

COMMENT ON COLUMN public.store_settings.ordering_mode IS 'Store ordering channel mode: standard (online checkout only), both (hybrid), whatsapp_only (catalog + WhatsApp cart order), catalog_only (digital showcase)';
