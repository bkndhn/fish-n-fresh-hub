CREATE OR REPLACE FUNCTION public.log_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history := COALESCE(OLD.status_history, '[]'::jsonb) ||
      jsonb_build_object('status', NEW.status, 'at', now(), 'note', NEW.delivery_note);
    IF NEW.status = 'delivered' THEN
      IF NEW.delivered_at IS NULL THEN
        NEW.delivered_at := now();
      END IF;
      IF lower(COALESCE(NEW.payment_method, '')) IN ('cod', 'cash') AND NEW.payment_status <> 'paid' THEN
        NEW.payment_status := 'paid';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

UPDATE public.orders
SET payment_status = 'paid'
WHERE status = 'delivered'
  AND lower(COALESCE(payment_method, '')) IN ('cod', 'cash')
  AND payment_status <> 'paid';