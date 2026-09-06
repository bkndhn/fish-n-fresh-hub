CREATE TABLE public.delivery_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  weekdays integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  capacity numeric NOT NULL DEFAULT 20,
  cutoff_minutes numeric NOT NULL DEFAULT 60,
  active boolean NOT NULL DEFAULT true,
  sort_order numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_windows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_windows TO authenticated;
GRANT ALL ON public.delivery_windows TO service_role;

ALTER TABLE public.delivery_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery windows public read"
  ON public.delivery_windows FOR SELECT
  USING (active OR public.is_staff());

CREATE POLICY "delivery windows staff manage"
  ON public.delivery_windows FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE TRIGGER delivery_windows_updated_at
  BEFORE UPDATE ON public.delivery_windows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.delivery_windows (label, start_time, end_time, sort_order) VALUES
  ('Morning 7–10 AM', '07:00', '10:00', 1),
  ('Midday 11 AM–2 PM', '11:00', '14:00', 2),
  ('Evening 5–8 PM', '17:00', '20:00', 3);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;