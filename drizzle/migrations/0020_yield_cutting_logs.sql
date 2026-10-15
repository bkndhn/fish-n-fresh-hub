CREATE TABLE public.yield_cutting_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid,
  product_id uuid,
  product_name text NOT NULL,
  raw_weight_kg numeric NOT NULL,
  purchase_cost_per_kg numeric NOT NULL,
  total_raw_cost numeric NOT NULL,
  cleaned_weight_kg numeric NOT NULL,
  byproduct_revenue numeric NOT NULL DEFAULT 0,
  cutting_loss_pct numeric NOT NULL,
  true_cost_per_kg numeric NOT NULL,
  current_selling_price numeric NOT NULL DEFAULT 0,
  realized_margin_pct numeric NOT NULL DEFAULT 0,
  notes text,
  logged_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.yield_cutting_logs TO authenticated;
GRANT ALL ON public.yield_cutting_logs TO service_role;
ALTER TABLE public.yield_cutting_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads yield" ON public.yield_cutting_logs FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY "managers write yield" ON public.yield_cutting_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'inventory_manager'));
CREATE POLICY "admins delete yield" ON public.yield_cutting_logs FOR DELETE TO authenticated USING (public.is_admin());