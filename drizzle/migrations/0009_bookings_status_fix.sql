DROP POLICY IF EXISTS "bookings public create validated" ON public.function_bookings;
CREATE POLICY "bookings public create validated" ON public.function_bookings
  FOR INSERT WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    AND status IN ('new','pending')
    AND length(trim(customer_name)) > 0
    AND length(regexp_replace(customer_phone, '\D', '', 'g')) BETWEEN 10 AND 15
  );