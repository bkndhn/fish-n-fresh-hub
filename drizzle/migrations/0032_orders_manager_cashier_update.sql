CREATE POLICY "orders manager cashier update" ON public.orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'))
WITH CHECK (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));
CREATE POLICY "orders manager cashier read" ON public.orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));