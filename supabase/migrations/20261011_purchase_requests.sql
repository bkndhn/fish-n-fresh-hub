CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage purchase requests" ON public.purchase_requests;
CREATE POLICY "admins manage purchase requests" ON public.purchase_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
