
-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','staff','driver','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','staff','driver'));
$$;

CREATE POLICY "profiles readable by owner or admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own or admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles delete own or admin" ON public.profiles FOR DELETE TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "roles readable by owner or admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ categories ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  image_url text,
  icon text,
  sort_order numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ branches ============
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  manager text,
  lat numeric,
  lng numeric,
  open_time text,
  close_time text,
  delivery_radius_km numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches public read" ON public.branches FOR SELECT USING (true);
CREATE POLICY "branches admin write" ON public.branches FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ products ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_tamil text,
  description text,
  price numeric NOT NULL,
  old_price numeric,
  unit text NOT NULL DEFAULT 'kg',
  category text,
  image_url text,
  stock numeric NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  origin text,
  rating numeric NOT NULL DEFAULT 4.5,
  is_featured boolean NOT NULL DEFAULT false,
  tags text[],
  calories numeric,
  protein text,
  best_for text,
  benefits text[],
  storage text,
  catch_date date,
  source_origin text,
  lab_tested boolean NOT NULL DEFAULT false,
  traceability text,
  recipe_title text,
  recipe_steps text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX products_category_idx ON public.products(category);

-- ============ promotions ============
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'coupon',
  code text,
  discount_type text NOT NULL DEFAULT 'percent',
  value numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  special_day text,
  target_phone text,
  one_time_per_customer boolean NOT NULL DEFAULT false,
  used_phones text[] NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions public read" ON public.promotions FOR SELECT USING (true);
CREATE POLICY "promotions admin write" ON public.promotions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ orders ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  customer_address text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  additional_charges numeric NOT NULL DEFAULT 0,
  additional_charge_label text,
  discount numeric NOT NULL DEFAULT 0,
  coupon_code text,
  promotion_id uuid,
  gst_amount numeric NOT NULL DEFAULT 0,
  gst_percent numeric,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'cod',
  fulfillment_type text NOT NULL DEFAULT 'delivery',
  delivery_date date,
  delivery_slot text,
  delivered_at timestamptz,
  location_lat numeric,
  location_lng numeric,
  map_link text,
  upi_paid boolean NOT NULL DEFAULT false,
  whatsapp_sent boolean NOT NULL DEFAULT false,
  driver_id uuid,
  driver_name text,
  notes text,
  cancel_reason text,
  branch_id uuid,
  branch_name text,
  referral_code text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders public read" ON public.orders FOR SELECT USING (true);
CREATE POLICY "orders public create" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders staff update" ON public.orders FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX orders_phone_idx ON public.orders(customer_phone);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_idx ON public.orders(created_at DESC);

-- ============ store_settings ============
CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'Fish N Fresh',
  tagline text,
  shop_logo text,
  open_time text,
  close_time text,
  lunch_start text,
  lunch_end text,
  block_during_lunch boolean NOT NULL DEFAULT false,
  weekly_holidays text[] NOT NULL DEFAULT '{}',
  holidays text,
  holiday_dates text[] NOT NULL DEFAULT '{}',
  block_on_holidays boolean NOT NULL DEFAULT false,
  whatsapp_number text,
  upi_id text,
  upi_name text NOT NULL DEFAULT 'Fish N Fresh',
  delivery_fee numeric NOT NULL DEFAULT 40,
  free_delivery_over numeric NOT NULL DEFAULT 500,
  min_order_value numeric NOT NULL DEFAULT 0,
  delivery_radius_km numeric NOT NULL DEFAULT 0,
  additional_charge_label text NOT NULL DEFAULT 'Packing & Handling',
  additional_charge_value numeric NOT NULL DEFAULT 0,
  delivery_enabled boolean NOT NULL DEFAULT true,
  pickup_enabled boolean NOT NULL DEFAULT true,
  cod_enabled boolean NOT NULL DEFAULT true,
  online_enabled boolean NOT NULL DEFAULT true,
  store_address text,
  store_lat numeric,
  store_lng numeric,
  is_open boolean NOT NULL DEFAULT true,
  announcement text,
  low_stock_threshold numeric NOT NULL DEFAULT 10,
  primary_color text NOT NULL DEFAULT '#0c6ca8',
  accent_color text NOT NULL DEFAULT '#15b3a0',
  gst_enabled boolean NOT NULL DEFAULT false,
  gst_percent numeric NOT NULL DEFAULT 5,
  gstin text,
  footer_about text,
  contact_email text,
  contact_phone text,
  support_whatsapp text,
  address_line text,
  facebook_url text,
  instagram_url text,
  twitter_url text,
  terms_content text,
  privacy_content text,
  refund_content text,
  home_show_banner boolean NOT NULL DEFAULT true,
  home_show_hero boolean NOT NULL DEFAULT true,
  home_show_trust boolean NOT NULL DEFAULT true,
  home_show_categories boolean NOT NULL DEFAULT true,
  home_show_bestsellers boolean NOT NULL DEFAULT true,
  home_show_featured boolean NOT NULL DEFAULT true,
  home_show_allproducts boolean NOT NULL DEFAULT true,
  serviceable_pincodes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.store_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ banners ============
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  link text,
  cta text,
  price_list text,
  active boolean NOT NULL DEFAULT true,
  sort_order numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners public read" ON public.banners FOR SELECT USING (true);
CREATE POLICY "banners admin write" ON public.banners FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ reviews ============
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_name text,
  order_id uuid,
  customer_name text,
  customer_phone text,
  rating numeric NOT NULL DEFAULT 5,
  comment text,
  photo_url text,
  verified boolean NOT NULL DEFAULT false,
  admin_reply text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT USING (active = true OR public.is_admin());
CREATE POLICY "reviews public create" ON public.reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "reviews admin write" ON public.reviews FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "reviews admin delete" ON public.reviews FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX reviews_product_idx ON public.reviews(product_id);

-- verification: a review is verified when the phone has a delivered order containing the product
CREATE OR REPLACE FUNCTION public.verify_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.verified := EXISTS (
    SELECT 1 FROM public.orders o, jsonb_array_elements(o.items) it
    WHERE o.customer_phone = NEW.customer_phone
      AND o.status = 'delivered'
      AND (it->>'product_id') = NEW.product_id::text
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER reviews_verify BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.verify_review();

-- ============ loyalty_accounts ============
CREATE TABLE public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  name text,
  points numeric NOT NULL DEFAULT 0,
  lifetime_points numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'Bronze',
  referral_code text,
  referred_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loyalty_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty public read" ON public.loyalty_accounts FOR SELECT USING (true);
CREATE POLICY "loyalty public create" ON public.loyalty_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "loyalty public update" ON public.loyalty_accounts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "loyalty admin delete" ON public.loyalty_accounts FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER loyalty_updated_at BEFORE UPDATE ON public.loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ order_templates ============
CREATE TABLE public.order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_templates TO authenticated;
GRANT ALL ON public.order_templates TO service_role;
ALTER TABLE public.order_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates own" ON public.order_templates FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.order_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ function_bookings ============
CREATE TABLE public.function_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  event_date date NOT NULL,
  event_type text,
  guest_count numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_estimate numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'new',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.function_bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.function_bookings TO authenticated;
GRANT ALL ON public.function_bookings TO service_role;
ALTER TABLE public.function_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings public create" ON public.function_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings read own or staff" ON public.function_bookings FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_staff());
CREATE POLICY "bookings admin update" ON public.function_bookings FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "bookings admin delete" ON public.function_bookings FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.function_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ subscriptions ============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  frequency text NOT NULL DEFAULT 'weekly',
  weekday numeric,
  next_delivery_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  payment_method text NOT NULL DEFAULT 'cod',
  fulfillment_type text NOT NULL DEFAULT 'delivery',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs read own or staff" ON public.subscriptions FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_staff());
CREATE POLICY "subs create own" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_staff());
CREATE POLICY "subs update own or staff" ON public.subscriptions FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_staff()) WITH CHECK (created_by = auth.uid() OR public.is_staff());
CREATE POLICY "subs admin delete" ON public.subscriptions FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER subs_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX subs_due_idx ON public.subscriptions(status, next_delivery_date);

-- ============ realtime ============
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.reviews REPLICA IDENTITY FULL;
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
