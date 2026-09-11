-- ==============================================================================
-- FISH N FRESH HUB: STANDALONE CLIENT SUPABASE BOOTSTRAP SCRIPT
-- ==============================================================================
-- Run this script ONCE in your new client's Supabase SQL Editor.
-- It initializes all tables, RLS policies, indexes, stored procedures,
-- and seeds the authentic real seafood and meat catalog.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Schema Version Marker
CREATE TABLE IF NOT EXISTS public.schema_version (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL,
    migration_hash TEXT NOT NULL,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.schema_version (version, migration_hash, description)
VALUES ('3.1.0', 'client_bootstrap_master', 'Complete standalone multi-tenant client database bootstrap')
ON CONFLICT DO NOTHING;

-- 3. Store Settings Table
CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_name TEXT DEFAULT 'Fish N Fresh Hub',
    store_phone TEXT DEFAULT '9843061919',
    store_email TEXT DEFAULT 'support@fishnfresh.in',
    store_address TEXT DEFAULT 'Main Beach Road, Chennai, Tamil Nadu',
    shop_lat NUMERIC DEFAULT 13.0827,
    shop_lng NUMERIC DEFAULT 80.2707,
    business_vertical TEXT DEFAULT 'seafood',
    upi_id TEXT DEFAULT '9843061919@upi',
    upi_name TEXT DEFAULT 'Fish N Fresh Hub',
    delivery_fee_base NUMERIC DEFAULT 30,
    per_km_charge NUMERIC DEFAULT 10,
    free_delivery_over NUMERIC DEFAULT 500,
    express_delivery_enabled BOOLEAN DEFAULT true,
    express_delivery_fee NUMERIC DEFAULT 25,
    express_sla_mins INTEGER DEFAULT 35,
    wallet_enabled BOOLEAN DEFAULT true,
    max_wallet_burn_percent NUMERIC DEFAULT 50,
    referral_reward_referrer NUMERIC DEFAULT 50,
    referral_reward_referee NUMERIC DEFAULT 50,
    live_alerts_enabled BOOLEAN DEFAULT true,
    harbour_source_name TEXT DEFAULT 'Kasimedu Fish Harbour',
    harbour_alert_title TEXT DEFAULT '🌅 Kasimedu 06:30 AM Boat Landed!',
    harbour_alert_message TEXT DEFAULT 'Fresh Vanjaram, White Prawns, and Snapper just unloaded. 100% chemical-free.',
    printer_paper_width TEXT DEFAULT '58mm',
    printer_auto_cut BOOLEAN DEFAULT true,
    printer_open_drawer BOOLEAN DEFAULT false,
    printer_header_line1 TEXT DEFAULT 'FISH N FRESH HUB',
    printer_header_line2 TEXT DEFAULT 'Fresh Seafood & Meat Superstore',
    printer_footer_text TEXT DEFAULT 'Fresh Catch Daily · No Returns After Cutting',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.store_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_ta TEXT,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pos_code INTEGER,
    name TEXT NOT NULL,
    name_ta TEXT,
    name_tamil TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    price NUMERIC NOT NULL,
    original_mrp NUMERIC,
    unit TEXT DEFAULT 'kg',
    stock NUMERIC DEFAULT 50,
    image_url TEXT,
    description TEXT,
    ai_benefits_summary TEXT,
    is_active BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_bestseller BOOLEAN DEFAULT false,
    hsn_code TEXT DEFAULT '0302',
    gst_percent NUMERIC DEFAULT 0,
    gst_included BOOLEAN DEFAULT true,
    brand TEXT,
    model_number TEXT,
    warranty_period_months INTEGER DEFAULT 0,
    specifications JSONB DEFAULT '{}'::jsonb,
    aisle_location TEXT,
    variants JSONB DEFAULT '[]'::jsonb,
    requires_serial BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_pos_code 
ON public.products (pos_code) 
WHERE pos_code IS NOT NULL AND is_active = true;

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT,
    user_id UUID,
    created_by UUID,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    location_lat NUMERIC,
    location_lng NUMERIC,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    delivery_fee NUMERIC NOT NULL DEFAULT 0,
    gst_amount NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'cash',
    actual_payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    stripe_session_id TEXT,
    stripe_refund_id TEXT,
    refund_amount NUMERIC DEFAULT 0,
    refunded_at TIMESTAMPTZ,
    fulfillment_type TEXT NOT NULL DEFAULT 'delivery',
    delivery_date TEXT,
    delivery_slot TEXT,
    notes TEXT,
    complaint TEXT,
    delivered_at TIMESTAMPTZ,
    cod_settled BOOLEAN DEFAULT false,
    settlement_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Customer Addresses Table
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    label TEXT NOT NULL DEFAULT 'Home',
    address TEXT NOT NULL,
    lat NUMERIC,
    lng NUMERIC,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Customer Wallets & Transactions
CREATE TABLE IF NOT EXISTS public.customer_wallets (
    user_id UUID PRIMARY KEY,
    balance NUMERIC DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by UUID,
    total_earned NUMERIC DEFAULT 0,
    total_redeemed NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Order Delivery PIN Security
CREATE TABLE IF NOT EXISTS public.order_delivery_pins (
    order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID,
    pin_code TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Payment Gateway Credentials
CREATE TABLE IF NOT EXISTS public.payment_gateway_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL,
    api_key TEXT,
    secret_key TEXT,
    webhook_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Row-Level Security (RLS) Policies
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Public Read for Store Catalog & Info
CREATE POLICY "Public read store_settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

-- Orders: Anyone can insert (for guest checkout), Authenticated Users see only their own
CREATE POLICY "Orders public insert" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders user select own" ON public.orders FOR SELECT USING (
    auth.uid() IS NULL OR
    user_id = auth.uid() OR
    created_by = auth.uid() OR
    customer_email = (auth.jwt() ->> 'email')
);
CREATE POLICY "Orders user update own" ON public.orders FOR UPDATE USING (
    auth.uid() IS NULL OR
    user_id = auth.uid() OR
    created_by = auth.uid()
);

-- Customer Addresses: Strictly user isolated
CREATE POLICY "Addresses user select own" ON public.customer_addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Addresses user insert own" ON public.customer_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Addresses user update own" ON public.customer_addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Addresses user delete own" ON public.customer_addresses FOR DELETE USING (auth.uid() = user_id);

-- Customer Wallets: Strictly user isolated
CREATE POLICY "Wallets user select own" ON public.customer_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Wallet txns user select own" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);

-- 12. Seed Real Seafood Categories & Products
INSERT INTO public.categories (id, name, name_ta, slug, sort_order, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Sea Fish', 'கடல் மீன்', 'sea-fish', 1, true),
    ('c2222222-2222-2222-2222-222222222222', 'Prawns & Shellfish', 'இறால் மற்றும் நண்டு', 'prawns-shellfish', 2, true),
    ('c3333333-3333-3333-3333-333333333333', 'Freshwater Fish', 'நன்னீர் மீன்', 'freshwater-fish', 3, true),
    ('c4444444-4444-4444-4444-444444444444', 'Poultry & Meat', 'நாட்டுக்கோழி & ஆட்டிறைச்சி', 'poultry-meat', 4, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.products (
    id, pos_code, name, name_ta, category_id, price, original_mrp, unit, stock, image_url, description, ai_benefits_summary, is_active, is_featured, is_bestseller, hsn_code
) VALUES
    ('a0000000-0000-0000-0000-000000000001', 1, 'Vanjaram / Seer Fish (King Mackerel)', 'வஞ்சிரம் மீன்', 'c1111111-1111-1111-1111-111111111111', 950, 1100, 'kg', 45, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800', 'The undisputed king of South Indian seafood. Dock-fresh from Kasimedu, thick steak slices.', 'High Omega-3 fatty acids, supports heart health.', true, true, true, '0302'),
    ('a0000000-0000-0000-0000-000000000002', 2, 'White Pomfret (Vellai Vavval)', 'வெள்ளை வவ்வால்', 'c1111111-1111-1111-1111-111111111111', 880, 1050, 'kg', 30, 'https://images.unsplash.com/photo-1534943441045-125078d6b8ec?w=800', 'Prized for delicate, sweet meat and minimal bones. Perfect for deep tawa fry.', 'Extremely low in saturated fats, rich in Vitamin D.', true, true, true, '0302'),
    ('a0000000-0000-0000-0000-000000000003', 3, 'Black Pomfret (Karuppu Vavval)', 'கருப்பு வவ்வால்', 'c1111111-1111-1111-1111-111111111111', 680, 800, 'kg', 35, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800', 'Rich, flavorful dark meat with appetizing ocean aroma.', 'Rich source of phosphorus and selenium.', true, false, true, '0302'),
    ('a0000000-0000-0000-0000-000000000004', 4, 'Kasimedu Tiger Prawns (Jumbo)', 'புலி இறால் (பெரியது)', 'c2222222-2222-2222-2222-222222222222', 720, 850, 'kg', 50, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800', 'Succulent, crisp coastal tiger prawns. Deveined on order.', 'Packed with astaxanthin antioxidant, high zinc.', true, true, true, '0306'),
    ('a0000000-0000-0000-0000-000000000005', 5, 'Live Sea Mud Crab (Nandu)', 'உயிருள்ள நண்டு', 'c2222222-2222-2222-2222-222222222222', 640, 750, 'kg', 25, 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800', 'Fresh live coastal crabs with sweet, tender claw meat.', 'Exceptional remedy for cold/congestion, high calcium.', true, false, true, '0306'),
    ('a0000000-0000-0000-0000-000000000006', 6, 'Red Snapper (Sankara)', 'சங்கரா மீன்', 'c1111111-1111-1111-1111-111111111111', 480, 580, 'kg', 40, 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', 'Firm, flaky pink-scaled ocean fish. Absorbs spicy gravies.', 'Low calorie density with high potassium.', true, false, false, '0302'),
    ('a0000000-0000-0000-0000-000000000007', 7, 'White Anchovy (Nethili)', 'நெத்திலி மீன்', 'c1111111-1111-1111-1111-111111111111', 280, 340, 'kg', 60, 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800', 'Fresh small ocean anchovies. Cleaned head-off.', 'Consumed whole with soft bones for supreme calcium.', true, false, true, '0302'),
    ('a0000000-0000-0000-0000-000000000008', 8, 'Fresh Squid / Calamari (Kanava)', 'கணவாய் மீன்', 'c2222222-2222-2222-2222-222222222222', 520, 620, 'kg', 28, 'https://images.unsplash.com/photo-1608797178974-15b35a61dd75?w=800', 'Cleaned squid rings and tubes with no grit.', 'Rich in Vitamin B2 and choline.', true, false, false, '0307'),
    ('a0000000-0000-0000-0000-000000000009', 9, 'Free-Range Country Chicken (Nattu Kozhi)', 'நாட்டுக்கோழி', 'c4444444-4444-4444-4444-444444444444', 420, 490, 'kg', 35, 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800', 'Pure pasture-raised country chicken without antibiotics.', 'Rich in organic minerals and carnosine.', true, false, true, '0207'),
    ('a0000000-0000-0000-0000-000000000010', 10, 'Tender Goat / Mutton Curry Cut', 'ஆட்டிறைச்சி கறி வெட்டு', 'c4444444-4444-4444-4444-444444444444', 850, 980, 'kg', 25, 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800', 'Tender, fresh grass-fed goat. Balanced meat and bone.', 'Dense in heme iron and Vitamin B12.', true, true, true, '0204')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    pos_code = EXCLUDED.pos_code;

-- 13. Multi-Branch Support & Default Branches Initialization
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    code TEXT UNIQUE,
    address TEXT,
    phone TEXT,
    manager TEXT,
    manager_user_id UUID,
    lat NUMERIC,
    lng NUMERIC,
    open_time TEXT DEFAULT '06:00',
    close_time TEXT DEFAULT '21:00',
    delivery_radius_km NUMERIC NOT NULL DEFAULT 12,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    gstin TEXT DEFAULT '33AAACF1234F1Z5',
    fssai_license TEXT DEFAULT '12423008000123',
    upi_id TEXT,
    min_order_amount NUMERIC NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.branches (
    id, name, slug, code, address, phone, manager, lat, lng, open_time, close_time, delivery_radius_km, is_active, is_default, sort_order
) VALUES
    ('20f2ea34-9e3c-4999-aeac-7aae3367ee60', 'Chennai Harbour Hub', 'chennai-harbour', 'CHH', 'Harbour Road, Kasimedu, Chennai 600001', '+91 98765 43210', 'Ravi Kumar', 13.0827, 80.2707, '06:00', '21:00', 15, true, true, 1),
    ('53da6ab2-7cda-4499-b1a3-9b84a8c77398', 'Velachery Express Hub', 'velachery', 'VEL', '100 Feet Road, Velachery, Chennai 600042', '+91 98765 43211', 'Suresh M', 12.9791, 80.2209, '07:00', '21:00', 10, true, false, 2)
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    code = EXCLUDED.code,
    is_default = EXCLUDED.is_default;

-- Associate products with default flagship branch
UPDATE public.products
SET branch_id = '20f2ea34-9e3c-4999-aeac-7aae3367ee60'
WHERE branch_id IS NULL;


-- ============================================================================
-- Phase 4: Super Admin Governance Platform & Anti-Impersonation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name TEXT NOT NULL DEFAULT 'Fish N Fresh Enterprise',
  tenant_code TEXT NOT NULL UNIQUE DEFAULT 'FNF-MAIN',
  max_branches INTEGER NOT NULL DEFAULT 10,
  max_staff_per_branch INTEGER NOT NULL DEFAULT 15,
  max_monthly_orders INTEGER NOT NULL DEFAULT 25000,
  max_storage_mb INTEGER NOT NULL DEFAULT 5000,
  tier TEXT NOT NULL DEFAULT 'enterprise' CHECK (tier IN ('starter', 'growth', 'enterprise')),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.tenant_quotas (tenant_name, tenant_code, max_branches, max_staff_per_branch, max_monthly_orders, max_storage_mb, tier, is_locked)
VALUES ('Fish N Fresh Enterprise', 'FNF-MAIN', 10, 15, 25000, 5000, 'enterprise', false)
ON CONFLICT (tenant_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.platform_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'branch', 'user')),
  target_id TEXT,
  reason TEXT NOT NULL DEFAULT 'Administrative security revocation',
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revocations_scope_target ON public.platform_revocations(scope, target_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'super_admin',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.platform_audit_logs(action, created_at DESC);
