-- Bootstrap: first ever signup becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE has_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_admin;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN has_admin THEN 'user'::app_role ELSE 'admin'::app_role END)
  ON CONFLICT DO NOTHING;

  IF NOT has_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

-- Sample orders so admin/driver screens have real data
INSERT INTO public.orders (order_number, customer_name, customer_phone, customer_email, customer_address, items, subtotal, delivery_fee, additional_charges, discount, gst_amount, total, status, payment_method, fulfillment_type, delivery_date, delivery_slot, location_lat, location_lng, upi_paid)
SELECT 'FNF-1001', 'Arun Kumar', '9840012345', 'arun@example.com', '12 Marina Loop Rd, Chennai',
  jsonb_build_array(jsonb_build_object('product_id', p1.id, 'name', p1.name, 'price', p1.price, 'unit', p1.unit, 'qty', 2)),
  p1.price * 2, 40, 0, 0, 0, p1.price * 2 + 40, 'pending', 'cod', 'delivery', CURRENT_DATE, '9AM - 12PM', 13.0604, 80.2824, false
FROM public.products p1 ORDER BY p1.created_at LIMIT 1;

INSERT INTO public.orders (order_number, customer_name, customer_phone, customer_address, items, subtotal, delivery_fee, additional_charges, discount, gst_amount, total, status, payment_method, fulfillment_type, delivery_date, delivery_slot, location_lat, location_lng, upi_paid)
SELECT 'FNF-1002', 'Priya Raman', '9884456789', '45 Besant Nagar, Chennai',
  jsonb_build_array(jsonb_build_object('product_id', p1.id, 'name', p1.name, 'price', p1.price, 'unit', p1.unit, 'qty', 1)),
  p1.price, 40, 0, 0, 0, p1.price + 40, 'confirmed', 'upi', 'delivery', CURRENT_DATE, '5PM - 8PM', 12.9985, 80.2665, true
FROM public.products p1 ORDER BY p1.created_at OFFSET 1 LIMIT 1;

INSERT INTO public.orders (order_number, customer_name, customer_phone, customer_address, items, subtotal, delivery_fee, additional_charges, discount, gst_amount, total, status, payment_method, fulfillment_type, delivery_date, delivered_at, location_lat, location_lng, upi_paid)
SELECT 'FNF-1003', 'Mohan Das', '9791122334', '8 Anna Nagar, Chennai',
  jsonb_build_array(jsonb_build_object('product_id', p1.id, 'name', p1.name, 'price', p1.price, 'unit', p1.unit, 'qty', 3)),
  p1.price * 3, 0, 0, 0, 0, p1.price * 3, 'delivered', 'cod', 'delivery', CURRENT_DATE - 1, now() - interval '1 day', 13.0850, 80.2101, false
FROM public.products p1 ORDER BY p1.created_at OFFSET 2 LIMIT 1;