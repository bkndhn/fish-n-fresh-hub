import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import webpush from 'web-push'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: {
    id: string
    status: string
    order_number: string | null
    total: number
    payment_method: string | null
    user_id: string | null
    customer_phone: string | null
    customer_name: string | null
    branch_id: string | null
    driver_id: string | null
  }
  old_record: {
    status: string
  } | null
}

type NotificationPayload = {
  title: string
  body: string
  icon: string
  badge: string
  data: { url: string; order_id: string }
  tag: string
}

function getSupabase() {
  return createClient<Database>(
    process.env['SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!
  )
}

async function getTargetTokens(
  supabase: ReturnType<typeof getSupabase>,
  target: 'admin_staff' | 'driver' | 'customer',
  orderId: string,
  userId: string | null,
): Promise<Array<{ id: string; token: string; endpoint?: string }>> {
  let query = supabase.from('fcm_tokens').select('id, token')
  
  if (target === 'admin_staff') {
    query = query.in('role', ['admin', 'staff'])
  } else if (target === 'driver') {
    query = query.eq('role', 'driver')
  } else if (target === 'customer') {
    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      return []
    }
  }
  
  const { data } = await query
  return data || []
}

async function sendWebPushNotification(
  token: string,
  payload: NotificationPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; stale: boolean }> {
  if (!webpush) return { success: false, stale: false }
  
  try {
    let subscription: webpush.PushSubscription
    try {
      subscription = JSON.parse(token) as webpush.PushSubscription
    } catch {
      // Not a JSON subscription — skip (might be a placeholder token)
      return { success: false, stale: true }
    }
    
    if (!subscription.endpoint) return { success: false, stale: true }
    
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      { TTL: 86400, urgency: 'high' }
    )
    return { success: true, stale: false }
  } catch (err: any) {
    const statusCode = err?.statusCode ?? err?.status ?? 0
    // 404/410 = subscription expired/unregistered
    const stale = statusCode === 404 || statusCode === 410
    return { success: false, stale }
  }
}

async function dispatchNotifications(
  tokens: Array<{ id: string; token: string }>,
  payload: NotificationPayload,
  supabase: ReturnType<typeof getSupabase>
): Promise<void> {
  const vapidPublicKey = process.env['VITE_VAPID_PUBLIC_KEY'] || process.env['VAPID_PUBLIC_KEY'] || ''
  const vapidPrivateKey = process.env['VAPID_PRIVATE_KEY'] || ''
  const vapidSubject = process.env['VAPID_SUBJECT'] || 'mailto:admin@fishfresh.com'
  
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[order-alerts] VAPID keys not configured — skipping push')
    return
  }
  
  const staleIds: string[] = []
  
  // Process in chunks of 500
  const CHUNK = 500
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK)
    const results = await Promise.allSettled(
      chunk.map(({ id, token }) =>
        sendWebPushNotification(token, payload, vapidPublicKey, vapidPrivateKey, vapidSubject)
          .then((r) => ({ id, ...r }))
      )
    )
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.stale) {
        staleIds.push(result.value.id)
      }
    }
  }
  
  // Prune stale tokens
  if (staleIds.length > 0) {
    await supabase.from('fcm_tokens').delete().in('id', staleIds)
    console.log(`[order-alerts] Pruned ${staleIds.length} stale token(s)`)
  }
}

export const Route = createFileRoute('/api/public/order-alerts')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Validate webhook secret
      const secret = process.env['SUPABASE_WEBHOOK_SECRET'] || ''
      const incomingSecret = request.headers.get('x-webhook-secret') ||
        request.headers.get('authorization')?.replace('Bearer ', '') || ''
      
      if (secret && incomingSecret !== secret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      let payload: WebhookPayload
      try {
        payload = await request.json() as WebhookPayload
      } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 })
      }
      
      if (payload.table !== 'orders') {
        return Response.json({ message: 'Ignored — not orders table' })
      }
      
      const order = payload.record
      const oldStatus = payload.old_record?.status
      const newStatus = order.status
      
      // Skip if status unchanged on UPDATE
      if (payload.type === 'UPDATE' && oldStatus === newStatus) {
        return Response.json({ message: 'Status unchanged' })
      }
      
      const supabase = getSupabase()
      const orderNum = order.order_number || order.id.slice(0, 8)
      
      let notif: NotificationPayload | null = null
      let target: 'admin_staff' | 'driver' | 'customer' | null = null
      
      if (payload.type === 'INSERT' && newStatus === 'pending') {
        target = 'admin_staff'
        notif = {
          title: '🔔 New Order Received!',
          body: `Order #${orderNum} for ₹${order.total} (${order.payment_method || 'COD'}) is waiting for confirmation.`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-maskable-192.png',
          data: { url: '/_authenticated/admin/orders', order_id: order.id },
          tag: `new_order_${order.id}`,
        }
      } else if (payload.type === 'UPDATE' && (newStatus === 'ready' || newStatus === 'packed')) {
        target = 'driver'
        notif = {
          title: '📦 Delivery Ready for Pickup!',
          body: `Order #${orderNum} is packed on ice and ready for dispatch.`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-maskable-192.png',
          data: { url: '/driver', order_id: order.id },
          tag: `packed_${order.id}`,
        }
      } else if (payload.type === 'UPDATE' && newStatus === 'out_for_delivery') {
        target = 'customer'
        notif = {
          title: '🚚 Fresh Catch Out for Delivery!',
          body: 'Your order is on the way with your delivery partner. Track live!',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-maskable-192.png',
          data: { url: `/track/${order.id}`, order_id: order.id },
          tag: `delivery_${order.id}`,
        }
      } else if (payload.type === 'UPDATE' && newStatus === 'delivered') {
        target = 'customer'
        notif = {
          title: '🎉 Order Delivered!',
          body: `Your fresh seafood order #${orderNum} was safely delivered. Enjoy your meal!`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-maskable-192.png',
          data: { url: `/track/${order.id}`, order_id: order.id },
          tag: `delivered_${order.id}`,
        }
      }
      
      if (!notif || !target) {
        return Response.json({ message: `Status '${newStatus}' not a notification trigger` })
      }
      
      const tokens = await getTargetTokens(supabase, target, order.id, order.user_id)
      
      if (tokens.length === 0) {
        return Response.json({ message: 'No registered tokens for target' })
      }
      
      await dispatchNotifications(tokens, notif, supabase)
      
      return Response.json({
        success: true,
        target,
        status: newStatus,
        tokens_attempted: tokens.length,
      })
    },
  },
})
