
-- 1. customer_suspensions
ALTER TABLE public.customer_suspensions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_suspensions TO authenticated;
GRANT ALL ON public.customer_suspensions TO service_role;
DROP POLICY IF EXISTS "suspensions staff read" ON public.customer_suspensions;
CREATE POLICY "suspensions staff read" ON public.customer_suspensions FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "suspensions admin write" ON public.customer_suspensions;
CREATE POLICY "suspensions admin write" ON public.customer_suspensions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. product_requests
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_requests TO authenticated;
GRANT INSERT ON public.product_requests TO anon;
GRANT ALL ON public.product_requests TO service_role;
DROP POLICY IF EXISTS "product requests create" ON public.product_requests;
CREATE POLICY "product requests create" ON public.product_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(product_name)) BETWEEN 2 AND 200
    AND (customer_name IS NULL OR length(customer_name) <= 100)
    AND (customer_phone IS NULL OR customer_phone ~ '^[0-9]{10,15}$')
    AND (notes IS NULL OR length(notes) <= 1000)
  );
DROP POLICY IF EXISTS "product requests staff read" ON public.product_requests;
CREATE POLICY "product requests staff read" ON public.product_requests FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "product requests admin write" ON public.product_requests;
CREATE POLICY "product requests admin write" ON public.product_requests FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. reviews: hide reviewer phone from non-admin readers
REVOKE SELECT (customer_phone) ON public.reviews FROM anon, authenticated;
DROP POLICY IF EXISTS "reviews public read active" ON public.reviews;
CREATE POLICY "reviews public read active" ON public.reviews FOR SELECT TO anon, authenticated USING (active = true);

-- 4. orders guest insert validation
DROP POLICY IF EXISTS "orders create guest" ON public.orders;
CREATE POLICY "orders create guest" ON public.orders FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND created_by IS NULL
    AND length(btrim(customer_name)) BETWEEN 2 AND 100
    AND customer_phone ~ '^[0-9]{10,15}$'
    AND (customer_email IS NULL OR customer_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$')
    AND (customer_address IS NULL OR length(customer_address) <= 500)
    AND jsonb_typeof(items) = 'array'
    AND jsonb_array_length(items) BETWEEN 1 AND 100
    AND subtotal >= 0 AND delivery_fee >= 0 AND discount >= 0 AND total >= 0
    AND total <= 1000000
    AND status = 'pending'
    AND payment_status IN ('unpaid','pending')
    AND upi_paid = false
    AND refund_amount = 0
    AND driver_id IS NULL
  );

-- 5. storage: ownership checks on the images bucket
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
CREATE POLICY "Users update own images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND (owner = auth.uid() OR public.is_admin()))
  WITH CHECK (bucket_id = 'images' AND (owner = auth.uid() OR public.is_admin()));
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
CREATE POLICY "Users delete own images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND (owner = auth.uid() OR public.is_admin()));
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Users upload own images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND owner = auth.uid());

-- 6. internal SECURITY DEFINER / trigger functions must not be callable by app users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.verify_review() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.log_order_status() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
