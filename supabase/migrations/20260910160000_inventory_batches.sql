-- ==============================================================================
-- Inventory Batch & Catch Lot Traceability System (Food Safety & Recall Engine)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  supplier_id UUID,
  supplier_name TEXT,
  catch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  catch_harbour TEXT NOT NULL DEFAULT 'Kasimedu Harbour, Chennai',
  boat_number TEXT,
  initial_quantity NUMERIC NOT NULL DEFAULT 0,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  cold_chain_temp_celsius NUMERIC NOT NULL DEFAULT -1.5,
  shelf_life_hours INTEGER NOT NULL DEFAULT 72,
  expiry_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
  quality_grade TEXT NOT NULL DEFAULT 'Grade A+ (Export Quality)',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'recalled', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning queries
CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_id ON public.inventory_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON public.inventory_batches (status);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON public.inventory_batches (expiry_date);

-- Grants
GRANT SELECT ON public.inventory_batches TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.inventory_batches TO authenticated, service_role;

-- Enable RLS
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

-- Hardened Policies
DROP POLICY IF EXISTS "Public can view active batch traceability" ON public.inventory_batches;
CREATE POLICY "Public can view active batch traceability" ON public.inventory_batches
  FOR SELECT USING (status = 'active' OR public.is_staff() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage inventory batches" ON public.inventory_batches;
CREATE POLICY "Admins manage inventory batches" ON public.inventory_batches
  FOR ALL TO authenticated USING (public.is_staff() OR public.is_admin()) WITH CHECK (public.is_staff() OR public.is_admin());

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_batches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_batches;
  END IF;
END $$;

-- Seed Authentic Indian Coastal Seafood Catch Batches
INSERT INTO public.inventory_batches (
  batch_number, product_id, product_name, supplier_name, catch_date, catch_harbour, boat_number,
  initial_quantity, current_quantity, unit, cold_chain_temp_celsius, shelf_life_hours, expiry_date, quality_grade, status
) VALUES
  ('LOT-KAS-20260910-01', 'cac8a665-4775-4d2e-90cf-e75883d68661', 'Seer Fish (Vanjaram)', 'Kasimedu Deep Sea Fishermen Society', CURRENT_DATE, 'Kasimedu Harbour, Chennai', 'TN-02-MM-1092', 45.0, 42.5, 'kg', -1.8, 72, now() + interval '68 hours', 'Grade A+ (Export Quality)', 'active'),
  ('LOT-THO-20260910-02', 'f549663e-b96c-447b-b466-e30298ad896b', 'Pomfret White', 'Thoothukudi Pearl Coast Trawlers', CURRENT_DATE, 'Thoothukudi Fishing Harbour', 'TN-69-TT-4421', 30.0, 26.0, 'kg', -1.2, 48, now() + interval '42 hours', 'Grade A (Wild Caught)', 'active'),
  ('LOT-CUD-20260910-03', '558f8c1c-6fee-424f-9ef3-de13c95d6344', 'Tiger Prawns Large', 'Cuddalore Coastal Cooperative', CURRENT_DATE, 'Cuddalore Port Docks', 'TN-31-CD-8810', 50.0, 38.0, 'kg', -2.0, 36, now() + interval '30 hours', 'Grade A+ (Export Quality)', 'active'),
  ('LOT-RAM-20260910-04', '502740eb-1cfc-4405-aa18-93c31e3c7c85', 'Blue Swimmer Crab', 'Rameswaram Sea Hunters', CURRENT_DATE, 'Rameswaram Jetty', 'TN-65-RM-3301', 25.0, 20.0, 'kg', 0.5, 24, now() + interval '18 hours', 'Grade A (Live Caught)', 'active')
ON CONFLICT (batch_number) DO NOTHING;
