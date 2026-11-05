CREATE OR REPLACE FUNCTION public.credit_wallet_cashback(p_order_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  o record;
  pct numeric := 0;
  amt numeric := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sign in required');
  END IF;
  SELECT id, user_id, total, status, payment_status INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;
  IF COALESCE(o.payment_status,'') <> 'paid' OR COALESCE(o.status,'') NOT IN ('delivered','completed') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cashback is credited after the order is paid and delivered');
  END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE order_id = p_order_id AND type = 'cashback') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cashback already credited');
  END IF;
  SELECT COALESCE(cashback_percent, 0) INTO pct FROM public.store_settings LIMIT 1;
  amt := round(COALESCE(o.total, 0) * COALESCE(pct, 0) / 100);
  IF amt <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No cashback applicable');
  END IF;
  PERFORM public.ensure_my_wallet();
  UPDATE public.customer_wallets
     SET balance = balance + amt, total_earned = COALESCE(total_earned, 0) + amt, updated_at = now()
   WHERE user_id = uid;
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, description, order_id)
  VALUES (uid, amt, 'cashback', 'Cashback on order', p_order_id);
  RETURN jsonb_build_object('success', true, 'amount', amt);
END;
$function$;

DROP POLICY IF EXISTS "Staff and admin insert settlements" ON public.driver_cash_settlements;