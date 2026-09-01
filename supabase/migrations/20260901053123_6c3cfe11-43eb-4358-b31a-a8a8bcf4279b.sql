ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE INDEX IF NOT EXISTS orders_stripe_session_idx ON public.orders (stripe_session_id);

DO $$
DECLARE p1 record; p2 record; p3 record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders) THEN RETURN; END IF;
  SELECT id, name, price, unit INTO p1 FROM public.products ORDER BY name LIMIT 1;
  SELECT id, name, price, unit INTO p2 FROM public.products ORDER BY name OFFSET 1 LIMIT 1;
  SELECT id, name, price, unit INTO p3 FROM public.products ORDER BY name OFFSET 2 LIMIT 1;
  IF p1.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.orders (order_number, customer_name, customer_phone, customer_address, items, subtotal, delivery_fee, discount, total, status, payment_method, payment_status, fulfillment_type, delivery_date, delivery_slot, driver_name, upi_paid, delivered_at, created_at)
  VALUES
    ('FNF-1001','Arun Kumar','+919876543210','12 Marina Street, Chennai',
      jsonb_build_array(jsonb_build_object('product_id',p1.id,'name',p1.name,'price',p1.price,'qty',2,'unit',p1.unit)),
      p1.price*2, 40, 0, p1.price*2+40, 'delivered','cod','paid','delivery', current_date-3, '9AM - 12PM','Ravi', false, now()-interval '3 day', now()-interval '3 day'),
    ('FNF-1002','Priya Selvam','+919812345678','44 Beach Road, Chennai',
      jsonb_build_array(jsonb_build_object('product_id',p2.id,'name',p2.name,'price',p2.price,'qty',1,'unit',p2.unit),
                        jsonb_build_object('product_id',p3.id,'name',p3.name,'price',p3.price,'qty',3,'unit',p3.unit)),
      p2.price+p3.price*3, 0, 50, p2.price+p3.price*3-50, 'out_for_delivery','upi','paid','delivery', current_date, '4PM - 7PM','Suresh', true, NULL, now()-interval '4 hour'),
    ('FNF-1003','Mohan Das','+919700112233','7 Harbour View, Chennai',
      jsonb_build_array(jsonb_build_object('product_id',p1.id,'name',p1.name,'price',p1.price,'qty',1,'unit',p1.unit)),
      p1.price, 40, 0, p1.price+40, 'pending','cod','unpaid','delivery', current_date, '9AM - 12PM', NULL, false, NULL, now()-interval '40 minute'),
    ('FNF-1004','Lakshmi R','+919845001122',NULL,
      jsonb_build_array(jsonb_build_object('product_id',p3.id,'name',p3.name,'price',p3.price,'qty',2,'unit',p3.unit)),
      p3.price*2, 0, 0, p3.price*2, 'confirmed','upi','paid','pickup', current_date, '12PM - 3PM', NULL, true, NULL, now()-interval '2 hour'),
    ('FNF-1005','Arun Kumar','+919876543210','12 Marina Street, Chennai',
      jsonb_build_array(jsonb_build_object('product_id',p2.id,'name',p2.name,'price',p2.price,'qty',4,'unit',p2.unit)),
      p2.price*4, 0, 100, p2.price*4-100, 'delivered','upi','paid','delivery', current_date-10, '4PM - 7PM','Ravi', true, now()-interval '10 day', now()-interval '10 day');
END $$;