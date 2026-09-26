import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const webhookSecret = Deno.env.get('SUPABASE_WEBHOOK_SECRET') || ''
  // Only the database trigger (which knows the shared secret) may invoke this function.
  const supplied =
    req.headers.get('x-webhook-secret') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!webhookSecret || supplied !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

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
