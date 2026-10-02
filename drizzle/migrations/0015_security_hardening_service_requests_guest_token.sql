ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_access_hash text;

DROP POLICY IF EXISTS "Staff can update service requests" ON public.table_service_requests;
DROP POLICY IF EXISTS "Allow public insert service requests" ON public.table_service_requests;
DROP POLICY IF EXISTS "Allow public select service requests" ON public.table_service_requests;

CREATE POLICY "Team manages service requests" ON public.table_service_requests
  FOR UPDATE TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

CREATE POLICY "Diners cancel pending requests" ON public.table_service_requests
  FOR UPDATE TO anon, authenticated
  USING (status = 'pending' AND created_at > now() - interval '12 hours')
  WITH CHECK (status = 'cancelled');

CREATE POLICY "Diners submit valid requests" ON public.table_service_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND request_type IN ('waiter_call','bill_request','water','cutlery','cleaning','custom')
    AND length(table_number) BETWEEN 1 AND 16
    AND (details IS NULL OR length(details) <= 300)
  );

CREATE POLICY "Team reads all service requests" ON public.table_service_requests
  FOR SELECT TO authenticated USING (public.is_team_member());

CREATE POLICY "Diners read recent active requests" ON public.table_service_requests
  FOR SELECT TO anon, authenticated
  USING (status IN ('pending','acknowledged') AND created_at > now() - interval '12 hours');