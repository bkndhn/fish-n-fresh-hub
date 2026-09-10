-- ==============================================================================
-- Recurring Seafood Subscriptions Engine (Weekly / Daily Repeat Deliveries)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT NOT NULL,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1.0,
  unit TEXT NOT NULL DEFAULT 'kg',
  cutting_style TEXT NOT NULL DEFAULT 'Curry Cut',
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'bi_weekly', 'monthly')),
  day_of_week TEXT NOT NULL DEFAULT 'sunday' CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  preferred_slot TEXT NOT NULL DEFAULT '07:00 AM - 09:00 AM (Early Catch)',
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC NOT NULL DEFAULT 5.0,
  next_delivery_date DATE NOT NULL DEFAULT (CURRENT_DATE + interval '3 days'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cod',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_subs_user_id ON public.customer_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_customer_subs_status ON public.customer_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_customer_subs_next_date ON public.customer_subscriptions (next_delivery_date);

-- Enable RLS
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Customers can view their own subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Customers can view their own subscriptions" ON public.customer_subscriptions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Customers can manage their own subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Customers can manage their own subscriptions" ON public.customer_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- Seed Initial Realistic Seafood Subscription
INSERT INTO public.customer_subscriptions (
  customer_name, customer_phone, customer_email, customer_address,
  product_id, product_name, quantity, unit, cutting_style, frequency,
  day_of_week, preferred_slot, price_per_unit, total_price, discount_percent, next_delivery_date, status
) VALUES
  (
    'Ramesh Sundaram', '9843061919', 'ramesh.s@gmail.com', 'Flat 4B, Coastal Residency, Besant Nagar, Chennai - 600090',
    'a0000000-0000-0000-0000-000000000001', 'Vanjaram / King Seer Fish Steaks', 1.0, 'kg', 'Fry Cut / Slices', 'weekly',
    'sunday', '07:00 AM - 09:00 AM (Early Catch)', 850, 807.5, 5.0, CURRENT_DATE + interval '4 days', 'active'
  ),
  (
    'Ananya Natarajan', '9444123456', 'ananya.n@outlook.com', 'No 22, TTK Road, Alwarpet, Chennai - 600018',
    'a0000000-0000-0000-0000-000000000004', 'Fresh Sea Tiger Prawns (Medium-Large)', 1.0, 'kg', 'Cleaned & Deveined', 'weekly',
    'wednesday', '07:00 AM - 09:00 AM (Early Catch)', 750, 712.5, 5.0, CURRENT_DATE + interval '2 days', 'active'
  )
ON CONFLICT DO NOTHING;
