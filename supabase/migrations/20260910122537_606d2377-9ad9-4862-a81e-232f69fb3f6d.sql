-- Inventory batch / catch lot traceability
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
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
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','depleted','recalled','expired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inventory_batches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_batches TO authenticated;
GRANT ALL ON public.inventory_batches TO service_role;

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view batch traceability"
  ON public.inventory_batches FOR SELECT USING (true);

CREATE POLICY "Staff manage inventory batches"
  ON public.inventory_batches FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_id ON public.inventory_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON public.inventory_batches (status);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON public.inventory_batches (expiry_date);

CREATE TRIGGER inventory_batches_updated_at
  BEFORE UPDATE ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recurring customer subscriptions
CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1.0,
  unit TEXT NOT NULL DEFAULT 'kg',
  cutting_style TEXT NOT NULL DEFAULT 'Curry Cut',
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','bi_weekly','monthly')),
  day_of_week TEXT NOT NULL DEFAULT 'sunday' CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  preferred_slot TEXT NOT NULL DEFAULT '07:00 AM - 09:00 AM (Early Catch)',
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 5.0,
  next_delivery_date DATE NOT NULL DEFAULT (CURRENT_DATE + interval '3 days'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cod',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_subscriptions TO authenticated;
GRANT ALL ON public.customer_subscriptions TO service_role;

ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view their own subscriptions"
  ON public.customer_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "Customers create their own subscriptions"
  ON public.customer_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "Customers update their own subscriptions"
  ON public.customer_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "Staff delete subscriptions"
  ON public.customer_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE INDEX IF NOT EXISTS idx_customer_subs_user_id ON public.customer_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_customer_subs_status ON public.customer_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_customer_subs_next_date ON public.customer_subscriptions (next_delivery_date);

CREATE TRIGGER customer_subscriptions_updated_at
  BEFORE UPDATE ON public.customer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sample catch lots tied to the real seeded catalogue
INSERT INTO public.inventory_batches (
  batch_number, product_id, product_name, supplier_name, catch_date, catch_harbour, boat_number,
  initial_quantity, current_quantity, unit, cold_chain_temp_celsius, shelf_life_hours, expiry_date, quality_grade, status
) VALUES
  ('LOT-KAS-01', 'cac8a665-4775-4d2e-90cf-e75883d68661', 'Seer Fish (Vanjaram)', 'Kasimedu Deep Sea Fishermen Society', CURRENT_DATE, 'Kasimedu Harbour, Chennai', 'TN-02-MM-1092', 45.0, 42.5, 'kg', -1.8, 72, now() + interval '68 hours', 'Grade A+ (Export Quality)', 'active'),
  ('LOT-THO-02', 'f549663e-b96c-447b-b466-e30298ad896b', 'Pomfret White', 'Thoothukudi Pearl Coast Trawlers', CURRENT_DATE, 'Thoothukudi Fishing Harbour', 'TN-69-TT-4421', 30.0, 26.0, 'kg', -1.2, 48, now() + interval '42 hours', 'Grade A (Wild Caught)', 'active'),
  ('LOT-CUD-03', '558f8c1c-6fee-424f-9ef3-de13c95d6344', 'Tiger Prawns Large', 'Cuddalore Coastal Cooperative', CURRENT_DATE, 'Cuddalore Port Docks', 'TN-31-CD-8810', 50.0, 38.0, 'kg', -2.0, 36, now() + interval '30 hours', 'Grade A+ (Export Quality)', 'active'),
  ('LOT-RAM-04', '502740eb-1cfc-4405-aa18-93c31e3c7c85', 'Blue Swimmer Crab', 'Rameswaram Sea Hunters', CURRENT_DATE, 'Rameswaram Jetty', 'TN-65-RM-3301', 25.0, 20.0, 'kg', 0.5, 24, now() + interval '18 hours', 'Grade A (Live Caught)', 'active')
ON CONFLICT (batch_number) DO NOTHING;

-- Sample subscriptions tied to the real seeded catalogue
INSERT INTO public.customer_subscriptions (
  customer_name, customer_phone, customer_email, customer_address,
  product_id, product_name, quantity, unit, cutting_style, frequency,
  day_of_week, preferred_slot, price_per_unit, total_price, discount_percent, next_delivery_date, status
) VALUES
  ('Ramesh Sundaram', '9843061919', 'ramesh.s@example.com', 'Flat 4B, Coastal Residency, Besant Nagar, Chennai - 600090',
   'cac8a665-4775-4d2e-90cf-e75883d68661', 'Seer Fish (Vanjaram)', 1.0, 'kg', 'Fry Cut / Slices', 'weekly',
   'sunday', '07:00 AM - 09:00 AM (Early Catch)', 850, 807.5, 5.0, CURRENT_DATE + interval '4 days', 'active'),
  ('Ananya Natarajan', '9444123456', 'ananya.n@example.com', 'No 22, TTK Road, Alwarpet, Chennai - 600018',
   '558f8c1c-6fee-424f-9ef3-de13c95d6344', 'Tiger Prawns Large', 1.0, 'kg', 'Cleaned & Deveined', 'weekly',
   'wednesday', '07:00 AM - 09:00 AM (Early Catch)', 750, 712.5, 5.0, CURRENT_DATE + interval '2 days', 'active');

INSERT INTO public.schema_version (version, migration_hash, description)
VALUES ('2.4.0', '20260910190000', 'Inventory batches and customer subscriptions with grants and scoped access');