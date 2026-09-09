-- ==============================================================================
-- Migration: Live Alerts Toggle, Best Sellers Pinning, and Driver Cash Settlements
-- 1. Live Catch / Boat Landing Alerts Switch in store_settings
-- 2. Best Sellers Pinning in products
-- 3. Driver COD Cash Handover & Settlement Ledger
-- ==============================================================================

DO $$
BEGIN
  -- 1. Live Catch Alerts in store_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='live_alerts_enabled') THEN
    ALTER TABLE public.store_settings ADD COLUMN live_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='harbour_source_name') THEN
    ALTER TABLE public.store_settings ADD COLUMN harbour_source_name TEXT DEFAULT 'Kasimedu Harbour, Chennai';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='harbour_alert_title') THEN
    ALTER TABLE public.store_settings ADD COLUMN harbour_alert_title TEXT DEFAULT '🌅 Daily Morning Boat Catch Alert';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='harbour_alert_message') THEN
    ALTER TABLE public.store_settings ADD COLUMN harbour_alert_message TEXT DEFAULT 'Morning boats arriving with fresh daily harvest. Chemical-free direct from dock.';
  END IF;

  -- 2. Best Sellers flag in products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_bestseller') THEN
    ALTER TABLE public.products ADD COLUMN is_bestseller BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 3. Driver Cash Settlements Table
CREATE TABLE IF NOT EXISTS public.driver_cash_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number TEXT UNIQUE NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_collected NUMERIC(10,2) NOT NULL,
  amount_settled NUMERIC(10,2) NOT NULL,
  balance_remaining NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  orders_count INT NOT NULL DEFAULT 1,
  order_ids TEXT[] DEFAULT '{}',
  settled_by_name TEXT NOT NULL,
  settled_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_mode VARCHAR(30) NOT NULL DEFAULT 'cash', -- 'cash', 'counter_upi', 'bank_transfer'
  notes TEXT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend Orders with COD Settlement Tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='cod_settled') THEN
    ALTER TABLE public.orders ADD COLUMN cod_settled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settlement_id') THEN
    ALTER TABLE public.orders ADD COLUMN settlement_id UUID REFERENCES public.driver_cash_settlements(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settled_at') THEN
    ALTER TABLE public.orders ADD COLUMN settled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Enable RLS & Policies for settlements
ALTER TABLE public.driver_cash_settlements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'driver_cash_settlements' AND policyname = 'Allow staff and admin to view settlements'
  ) THEN
    CREATE POLICY "Allow staff and admin to view settlements"
      ON public.driver_cash_settlements FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'driver_cash_settlements' AND policyname = 'Allow staff and admin to insert settlements'
  ) THEN
    CREATE POLICY "Allow staff and admin to insert settlements"
      ON public.driver_cash_settlements FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;
