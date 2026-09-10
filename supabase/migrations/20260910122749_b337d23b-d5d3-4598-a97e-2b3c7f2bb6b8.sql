ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.deduct_order_stock_atomic(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC;
    v_current_stock NUMERIC;
    v_items JSONB;
    v_already BOOLEAN;
    v_deducted_count INT := 0;
BEGIN
    SELECT items, stock_deducted INTO v_items, v_already
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF v_items IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF v_already THEN
        RETURN jsonb_build_object('success', true, 'deducted_items', 0, 'message', 'Stock already deducted for this order');
    END IF;

    IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No items found in order');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        BEGIN
            v_prod_id := COALESCE(v_item->>'product_id', v_item->>'productId')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_prod_id := NULL;
        END;

        v_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);

        IF v_prod_id IS NOT NULL AND v_qty > 0 THEN
            SELECT stock INTO v_current_stock FROM public.products WHERE id = v_prod_id FOR UPDATE;
            IF FOUND THEN
                UPDATE public.products
                SET stock = GREATEST(0, COALESCE(stock, 0) - v_qty), updated_at = now()
                WHERE id = v_prod_id;
                v_deducted_count := v_deducted_count + 1;
            END IF;
        END IF;
    END LOOP;

    UPDATE public.orders SET stock_deducted = true WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'deducted_items', v_deducted_count, 'message', 'Inventory decremented successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_order_stock_atomic(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_prod_id UUID;
    v_qty NUMERIC;
    v_items JSONB;
    v_deducted BOOLEAN;
    v_restored_count INT := 0;
BEGIN
    SELECT items, stock_deducted INTO v_items, v_deducted
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF v_items IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    IF NOT v_deducted THEN
        RETURN jsonb_build_object('success', true, 'restored_items', 0, 'message', 'Nothing to restore for this order');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        BEGIN
            v_prod_id := COALESCE(v_item->>'product_id', v_item->>'productId')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_prod_id := NULL;
        END;

        v_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);

        IF v_prod_id IS NOT NULL AND v_qty > 0 THEN
            UPDATE public.products
            SET stock = COALESCE(stock, 0) + v_qty, updated_at = now()
            WHERE id = v_prod_id;
            v_restored_count := v_restored_count + 1;
        END IF;
    END LOOP;

    UPDATE public.orders SET stock_deducted = false WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'restored_items', v_restored_count, 'message', 'Inventory restored successfully');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_order_stock_atomic(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.restore_order_stock_atomic(uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.deduct_order_stock_atomic(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_order_stock_atomic(uuid) TO service_role;

INSERT INTO public.schema_version (version, migration_hash, description)
VALUES ('2.5.0', '20260910193000', 'Idempotent stock deduction and restoral with stock_deducted marker');