-- Delivery status fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS eta_minutes numeric,
  ADD COLUMN IF NOT EXISTS delivery_note text,
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.orders SET user_id = created_by WHERE user_id IS NULL AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- Track status changes automatically
CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history := COALESCE(OLD.status_history, '[]'::jsonb) ||
      jsonb_build_object('status', NEW.status, 'at', now(), 'note', NEW.delivery_note);
    IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_status_history ON public.orders;
CREATE TRIGGER orders_status_history BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- Data isolation: customers only see their own orders
DROP POLICY IF EXISTS "orders public read" ON public.orders;
CREATE POLICY "orders read own or staff" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "orders public create" ON public.orders;
CREATE POLICY "orders create authenticated" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff());
CREATE POLICY "orders create guest" ON public.orders
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Loyalty: no longer world readable/writable
DROP POLICY IF EXISTS "loyalty public read" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "loyalty public update" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "loyalty public create" ON public.loyalty_accounts;
CREATE POLICY "loyalty staff read" ON public.loyalty_accounts
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "loyalty staff write" ON public.loyalty_accounts
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

REVOKE SELECT, INSERT, UPDATE ON public.loyalty_accounts FROM anon;
REVOKE SELECT ON public.orders FROM anon;