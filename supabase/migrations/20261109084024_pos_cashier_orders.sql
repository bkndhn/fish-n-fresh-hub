-- Cashiers and managers can save their own till (POS) bills and read them back.
CREATE POLICY "orders pos cashier create" ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'manager'))
  AND fulfillment_type = 'pos'
  AND pos_cashier_id = auth.uid()
  AND driver_id IS NULL
  AND total >= 0 AND total <= 1000000
);
CREATE POLICY "orders pos cashier read own" ON public.orders FOR SELECT TO authenticated
USING (
  pos_cashier_id = auth.uid()
  AND (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'manager'))
);
