CREATE TABLE public.trust_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'waves',
  sort_order numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trust_badges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_badges TO authenticated;
GRANT ALL ON public.trust_badges TO service_role;

ALTER TABLE public.trust_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trust_badges_public_read" ON public.trust_badges FOR SELECT USING (true);
CREATE POLICY "trust_badges_admin_manage" ON public.trust_badges FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trust_badges_updated_at BEFORE UPDATE ON public.trust_badges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.trust_badges (label, icon, sort_order) VALUES
  ('Daily catch', 'waves', 1),
  ('Lab tested', 'shield-check', 2),
  ('Same-day delivery', 'truck', 3);