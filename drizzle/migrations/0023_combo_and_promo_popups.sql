ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_combo boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS combo_items text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS combo_mrp numeric;

CREATE TABLE public.promo_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'combo' CHECK (kind IN ('combo','new_arrival','flash')),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  headline text NOT NULL,
  subtext text,
  badge text,
  delay_seconds integer NOT NULL DEFAULT 60 CHECK (delay_seconds BETWEEN 5 AND 600),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_popups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_popups TO authenticated;
GRANT ALL ON public.promo_popups TO service_role;
ALTER TABLE public.promo_popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active popups" ON public.promo_popups FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin_or_super() OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Admins manage popups" ON public.promo_popups FOR ALL TO authenticated USING (public.is_admin_or_super() OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.is_admin_or_super() OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER promo_popups_updated BEFORE UPDATE ON public.promo_popups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();