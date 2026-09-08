-- 19. Low Stock Alert Threshold for Products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS low_stock_threshold numeric DEFAULT 5;

-- 20. Store Inventory, GST Defaults & Urgency Settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS default_gst_percent numeric NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS show_stock_to_customers boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS stock_urgency_threshold numeric NOT NULL DEFAULT 8;

-- 21. Supplier Management & Harbour Sourcing Directory
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  harbour text,
  contact_person text,
  phone text NOT NULL,
  whatsapp text,
  email text,
  gstin text,
  upi_id text,
  balance_due numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 22. Purchase Orders / Catch Inward Ledger
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  harbour_location text,
  catch_date timestamptz NOT NULL DEFAULT now(),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'cash',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 23. Waste & Spoilage Management Ledger
CREATE TABLE IF NOT EXISTS public.waste_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  reason text NOT NULL, -- 'trimming_loss', 'spoilage', 'damaged_in_transit', 'customer_return'
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  cost_loss numeric NOT NULL DEFAULT 0,
  action_taken text NOT NULL DEFAULT 'discarded',
  logged_by text NOT NULL DEFAULT 'Admin / Cutting Master',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 24. Realtime for Suppliers, Purchases, Waste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'suppliers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'purchase_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'waste_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE waste_entries;
  END IF;
END $$;

-- 25. Row Level Security Policies
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Admin full access suppliers'
  ) THEN
    CREATE POLICY "Admin full access suppliers" ON public.suppliers
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Admin full access purchase_orders'
  ) THEN
    CREATE POLICY "Admin full access purchase_orders" ON public.purchase_orders
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'waste_entries' AND policyname = 'Admin full access waste_entries'
  ) THEN
    CREATE POLICY "Admin full access waste_entries" ON public.waste_entries
      FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
