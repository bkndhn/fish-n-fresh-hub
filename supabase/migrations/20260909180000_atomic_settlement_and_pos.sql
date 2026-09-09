-- ============================================================================
-- MIGRATION: 20260909180000_atomic_settlement_and_pos.sql
-- Description: Atomic Mutex for Cash Settlements, Doorstep COD <-> UPI QR tracking,
--              POS Retail Billing fields, and Store Printer configuration.
-- ============================================================================

-- 1. Add doorstep payment switching and POS billing columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS actual_payment_method text,
  ADD COLUMN IF NOT EXISTS actual_payment_ref text,
  ADD COLUMN IF NOT EXISTS paid_to_bank_directly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_cashier_id uuid,
  ADD COLUMN IF NOT EXISTS pos_cashier_name text,
  ADD COLUMN IF NOT EXISTS pos_amount_tendered numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_change_due numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_scale_weight_kg numeric;

-- 2. Add printer preferences to store_settings
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS printer_paper_width text NOT NULL DEFAULT '58mm',
  ADD COLUMN IF NOT EXISTS printer_auto_cut boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_open_drawer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printer_header_line1 text NOT NULL DEFAULT 'FISH N FRESH HUB',
  ADD COLUMN IF NOT EXISTS printer_header_line2 text NOT NULL DEFAULT 'Premium Quality Seafood & Meat',
  ADD COLUMN IF NOT EXISTS printer_footer_text text NOT NULL DEFAULT 'Thank You! Visit Again';

-- 3. Atomic Stored Procedure for Driver Cash Settlement with Row-Level Mutex
-- Prevents double-settlements and race conditions when multiple cashiers submit concurrently
CREATE OR REPLACE FUNCTION public.settle_driver_cod_orders_atomic(
  p_settlement_number text,
  p_driver_name text,
  p_driver_phone text,
  p_driver_id uuid,
  p_order_ids uuid[],
  p_amount_collected numeric,
  p_amount_settled numeric,
  p_balance_remaining numeric,
  p_settled_by_name text,
  p_settled_by_id uuid,
  p_payment_mode text,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locked_count integer;
  v_new_settlement_id uuid;
  v_settlement_record record;
BEGIN
  -- 1. Acquire exclusive lock on all target orders that are NOT yet settled (FOR UPDATE)
  SELECT COUNT(*)
  INTO v_locked_count
  FROM public.orders
  WHERE id = ANY(p_order_ids)
    AND (cod_settled IS FALSE OR cod_settled IS NULL)
  FOR UPDATE;

  -- 2. Check if all specified orders were successfully locked
  IF v_locked_count != array_length(p_order_ids, 1) THEN
    RAISE EXCEPTION 'ERR_ALREADY_SETTLED: One or more selected orders have already been settled or could not be locked.';
  END IF;

  -- 3. Insert new settlement ledger record
  INSERT INTO public.driver_cash_settlements (
    settlement_number,
    driver_name,
    driver_phone,
    driver_id,
    amount_collected,
    amount_settled,
    balance_remaining,
    orders_count,
    order_ids,
    settled_by_name,
    settled_by_id,
    payment_mode,
    notes,
    settled_at
  )
  VALUES (
    p_settlement_number,
    p_driver_name,
    p_driver_phone,
    p_driver_id,
    p_amount_collected,
    p_amount_settled,
    p_balance_remaining,
    array_length(p_order_ids, 1),
    p_order_ids,
    p_settled_by_name,
    p_settled_by_id,
    p_payment_mode,
    p_notes,
    now()
  )
  RETURNING * INTO v_settlement_record;

  v_new_settlement_id := v_settlement_record.id;

  -- 4. Mark all locked orders as settled in the same atomic transaction
  UPDATE public.orders
  SET
    cod_settled = true,
    settlement_id = v_new_settlement_id,
    settled_at = now()
  WHERE id = ANY(p_order_ids);

  -- 5. Return the created settlement record as JSON
  RETURN to_jsonb(v_settlement_record);
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_driver_cod_orders_atomic TO authenticated, service_role;
