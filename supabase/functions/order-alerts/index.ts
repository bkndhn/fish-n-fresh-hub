import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const webhookSecret = Deno.env.get('SUPABASE_WEBHOOK_SECRET') || ''
  // Forward the payload to the TanStack endpoint
  const appUrl = Deno.env.get('APP_URL') || 'https://your-app.com'
  const body = await req.text()
  
  const resp = await fetch(`${appUrl}/api/public/order-alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': webhookSecret,
    },
    body,
  })
  
  return new Response(await resp.text(), { status: resp.status })
})
