DROP POLICY IF EXISTS "Anyone can read active popups" ON public.promo_popups;
CREATE POLICY "Visitors read active popups" ON public.promo_popups FOR SELECT TO anon USING (is_active);
CREATE POLICY "Signed-in read popups" ON public.promo_popups FOR SELECT TO authenticated USING (is_active OR public.is_admin_or_super() OR public.has_role(auth.uid(), 'manager'::app_role));