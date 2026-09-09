-- ==============================================================================
-- Migration: Enterprise Growth Suite
-- 1. Customer Wallets & Referral Program (FreshCash)
-- 2. FCM Push Notification Tokens Foundation
-- 3. Pre-Generated Product AI Health & Culinary Benefits (Generate-Once)
-- 4. Morning Harbour Catch Broadcasts
-- 5. Express Delivery Turnaround & SLA Settings
-- ==============================================================================

-- 1. Customer Wallets Table
CREATE TABLE IF NOT EXISTS public.customer_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  referral_code VARCHAR(30) UNIQUE NOT NULL,
  referred_by UUID REFERENCES auth.users(id),
  total_earned NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_redeemed NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet Transactions Ledger
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.customer_wallets(user_id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  type VARCHAR(30) NOT NULL, -- 'referral_bonus', 'signup_bonus', 'cashback', 'order_redemption', 'admin_adjustment'
  description TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. FCM Push Notification Tokens
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer', -- 'customer', 'driver', 'staff', 'admin'
  device_type VARCHAR(20) NOT NULL DEFAULT 'web', -- 'web', 'android', 'ios'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Product AI Health & Culinary Benefits (Generate Once, Stored in DB)
CREATE TABLE IF NOT EXISTS public.product_ai_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  omega3_level VARCHAR(30) NOT NULL DEFAULT 'High',
  protein_per_100g VARCHAR(30) NOT NULL DEFAULT '20g',
  calories_per_100g VARCHAR(30) NOT NULL DEFAULT '110 kcal',
  benefits_en JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits_ta JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits_hi JSONB NOT NULL DEFAULT '[]'::jsonb,
  cooking_tips JSONB NOT NULL DEFAULT '[]'::jsonb,
  disclaimer TEXT NOT NULL DEFAULT '⚠️ AI-Generated Advisory: This nutritional guidance is compiled by AI for informational purposes. Nutritional values vary by harvest size and season. Please verify ingredients and check for seafood allergies before cooking.',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_used VARCHAR(50) NOT NULL DEFAULT 'lovable-ai-v1'
);

-- 4. Morning Harbour Catch Broadcasts
CREATE TABLE IF NOT EXISTS public.catch_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  harbour_source TEXT NOT NULL DEFAULT 'Kasimedu Harbour, Chennai',
  target_category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Extend Store Settings for Express Delivery, Wallet & FCM
DO $$
BEGIN
  -- Express Delivery
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='express_delivery_enabled') THEN
    ALTER TABLE public.store_settings ADD COLUMN express_delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='express_delivery_fee') THEN
    ALTER TABLE public.store_settings ADD COLUMN express_delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 25.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='express_sla_mins') THEN
    ALTER TABLE public.store_settings ADD COLUMN express_sla_mins INT NOT NULL DEFAULT 35;
  END IF;

  -- Wallet & Referral Program
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='wallet_enabled') THEN
    ALTER TABLE public.store_settings ADD COLUMN wallet_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='referral_reward_referrer') THEN
    ALTER TABLE public.store_settings ADD COLUMN referral_reward_referrer NUMERIC(10,2) NOT NULL DEFAULT 50.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='referral_reward_referee') THEN
    ALTER TABLE public.store_settings ADD COLUMN referral_reward_referee NUMERIC(10,2) NOT NULL DEFAULT 50.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='cashback_percent') THEN
    ALTER TABLE public.store_settings ADD COLUMN cashback_percent NUMERIC(5,2) NOT NULL DEFAULT 2.50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='max_wallet_burn_percent') THEN
    ALTER TABLE public.store_settings ADD COLUMN max_wallet_burn_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00;
  END IF;

  -- FCM Settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='fcm_server_key') THEN
    ALTER TABLE public.store_settings ADD COLUMN fcm_server_key TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='fcm_project_id') THEN
    ALTER TABLE public.store_settings ADD COLUMN fcm_project_id TEXT;
  END IF;
END $$;

-- 6. Row Level Security Policies
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ai_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catch_broadcasts ENABLE ROW LEVEL SECURITY;

-- Wallet RLS: Customers can view only their own wallet; Admins can view/update all
DROP POLICY IF EXISTS "Customer view own wallet" ON public.customer_wallets;
CREATE POLICY "Customer view own wallet" ON public.customer_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin full access wallets" ON public.customer_wallets;
CREATE POLICY "Admin full access wallets" ON public.customer_wallets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Wallet Transactions RLS
DROP POLICY IF EXISTS "Customer view own wallet tx" ON public.wallet_transactions;
CREATE POLICY "Customer view own wallet tx" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.customer_wallets WHERE user_id = auth.uid() AND user_id = wallet_transactions.wallet_id)
  );

DROP POLICY IF EXISTS "Admin full access wallet tx" ON public.wallet_transactions;
CREATE POLICY "Admin full access wallet tx" ON public.wallet_transactions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- FCM Tokens RLS
DROP POLICY IF EXISTS "User manage own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "User manage own fcm tokens" ON public.fcm_tokens
  FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Anon insert fcm token" ON public.fcm_tokens;
CREATE POLICY "Anon insert fcm token" ON public.fcm_tokens
  FOR INSERT TO anon WITH CHECK (TRUE);

-- Product AI Benefits RLS: Public read (visible to all customers & admins), Admin/Staff write
DROP POLICY IF EXISTS "Anyone can view product ai benefits" ON public.product_ai_benefits;
CREATE POLICY "Anyone can view product ai benefits" ON public.product_ai_benefits
  FOR SELECT TO public USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can insert or update ai benefits" ON public.product_ai_benefits;
CREATE POLICY "Authenticated can insert or update ai benefits" ON public.product_ai_benefits
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Catch Broadcasts RLS: Public read, Admin write
DROP POLICY IF EXISTS "Anyone can view active catch broadcasts" ON public.catch_broadcasts;
CREATE POLICY "Anyone can view active catch broadcasts" ON public.catch_broadcasts
  FOR SELECT TO public USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admin manage catch broadcasts" ON public.catch_broadcasts;
CREATE POLICY "Admin manage catch broadcasts" ON public.catch_broadcasts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
