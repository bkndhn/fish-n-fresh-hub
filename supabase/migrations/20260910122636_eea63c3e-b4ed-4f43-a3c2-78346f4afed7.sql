ALTER TABLE public.schema_version ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_version FROM anon, authenticated;
GRANT ALL ON public.schema_version TO service_role;

ALTER FUNCTION public.deduct_order_stock_atomic(uuid) SET search_path = public;
ALTER FUNCTION public.restore_order_stock_atomic(uuid) SET search_path = public;
ALTER FUNCTION public.settle_driver_cod_orders_atomic(text, text, text, uuid, uuid[], numeric, numeric, numeric, text, uuid, text, text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.deduct_order_stock_atomic(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.restore_order_stock_atomic(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.deduct_order_stock_atomic(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_order_stock_atomic(uuid) TO service_role;