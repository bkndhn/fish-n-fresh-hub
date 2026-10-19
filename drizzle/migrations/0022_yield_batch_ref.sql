ALTER TABLE public.yield_cutting_logs ADD COLUMN IF NOT EXISTS batch_ref text;
ALTER TABLE public.yield_cutting_logs ADD COLUMN IF NOT EXISTS delivery_date date DEFAULT CURRENT_DATE;
CREATE INDEX IF NOT EXISTS yield_logs_product_date_idx ON public.yield_cutting_logs(product_id, delivery_date);