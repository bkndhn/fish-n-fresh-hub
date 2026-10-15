CREATE TABLE public.supplier_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  supplier_phone text,
  entry_type text NOT NULL CHECK (entry_type IN ('bill','payment')),
  amount numeric NOT NULL CHECK (amount > 0),
  method text CHECK (method IN ('cash','upi','credit','bank')),
  reference text,
  due_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_dues TO authenticated;
GRANT ALL ON public.supplier_dues TO service_role;
ALTER TABLE public.supplier_dues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage supplier dues" ON public.supplier_dues FOR ALL TO authenticated
  USING (public.is_admin_or_super() OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.is_admin_or_super() OR public.has_role(auth.uid(),'manager'));