
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.verify_review() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon, public;

DROP POLICY "reviews public read" ON public.reviews;
CREATE POLICY "reviews public read active" ON public.reviews FOR SELECT USING (active = true);
CREATE POLICY "reviews admin read all" ON public.reviews FOR SELECT TO authenticated USING (public.is_admin());
