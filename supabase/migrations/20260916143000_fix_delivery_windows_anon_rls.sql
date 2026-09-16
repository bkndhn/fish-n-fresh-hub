-- Fix delivery_windows RLS policy that crashes for anon users.
-- The original "delivery windows public read" policy calls is_staff()
-- which was revoked from anon in migration 20260829082857.
-- PostgreSQL evaluates both sides of OR, causing 42501 even on active rows.

-- Drop the broken policy
DROP POLICY IF EXISTS "delivery windows public read" ON public.delivery_windows;

-- Create separate policies: one for anon (active only), one for authenticated (active + staff sees all)
CREATE POLICY "delivery_windows_anon_read_active"
  ON public.delivery_windows
  FOR SELECT
  TO anon
  USING (active = true);

CREATE POLICY "delivery_windows_authed_read"
  ON public.delivery_windows
  FOR SELECT
  TO authenticated
  USING (active = true OR public.is_staff());
