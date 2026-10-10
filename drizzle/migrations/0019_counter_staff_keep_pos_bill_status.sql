-- Cashiers and managers ring up POS bills: keep their paid/preparing status instead of resetting to pending.
CREATE OR REPLACE FUNCTION public.is_counter_staff()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
  AND role IN ('admin','super_admin','manager','staff','cashier')); $$;
REVOKE ALL ON FUNCTION public.is_counter_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_counter_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_order_pricing_counter_gate()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_counter_staff() THEN
    IF NEW.total IS NULL OR NEW.total < 0 OR COALESCE(NEW.discount,0) < 0 THEN
      RAISE EXCEPTION 'Invalid bill amount';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_order_pricing_counter_gate() FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.enforce_order_pricing()'::regprocedure) INTO src;
  src := replace(src, 'IF public.is_staff() THEN', 'IF public.is_staff() OR public.is_counter_staff() THEN');
  EXECUTE src;
END $do$;