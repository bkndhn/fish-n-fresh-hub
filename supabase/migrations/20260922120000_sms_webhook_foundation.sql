-- =================================================================================
-- FOUNDATION FOR SMS & WHATSAPP ALERTS (Edge Function Webhook)
-- =================================================================================
-- This trigger will automatically call the 'order-alerts' Edge Function whenever
-- an order's status changes.
-- 
-- IMPORTANT: Replace 'YOUR_PROJECT_REF' with your actual Supabase project ID
-- (found in your Supabase Dashboard URL: https://supabase.com/dashboard/project/...)
-- and make sure the pg_net extension is enabled.
-- =================================================================================

-- 1. Enable pg_net if not already enabled (used for making HTTP requests from DB)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the webhook function
CREATE OR REPLACE FUNCTION trigger_order_alerts_webhook()
RETURNS trigger AS 
BEGIN
  -- We only fire the webhook if the status has actually changed
  IF NEW.status <> OLD.status AND NEW.status IN ('shipped', 'delivered') THEN
    PERFORM net.http_post(
      -- REPLACE THIS URL WITH YOUR ACTUAL EDGE FUNCTION URL
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/order-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        -- Use your Anon or Service Role key here
        'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY'
      ),
      body := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )
    );
  END IF;
  
  RETURN NEW;
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on the orders table
DROP TRIGGER IF EXISTS order_status_alerts_trigger ON orders;
CREATE TRIGGER order_status_alerts_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_alerts_webhook();
