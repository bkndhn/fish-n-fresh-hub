-- Public read policies call these helpers; without EXECUTE the whole read 401s
-- for signed-out visitors (banners, trust badges, campaigns, catalogue view).
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_wholesale_buyer(uuid) TO anon, authenticated;