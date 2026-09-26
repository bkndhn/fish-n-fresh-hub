import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendWebPush, type PushSubscriptionJSON } from './webpush-edge.server'

export type NotificationPayload = {
  title: string
  body: string
  icon: string
  badge: string
  data: { url: string; order_id: string }
  tag: string
}

export async function getTargetTokens(
  supabase: typeof supabaseAdmin,
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

export async function sendWebPushNotification(
  token: string,
  payload: NotificationPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; stale: boolean }> {
  let subscription: PushSubscriptionJSON
  try {
    subscription = JSON.parse(token) as PushSubscriptionJSON
  } catch {
    // Not a JSON subscription — skip (might be a placeholder token)
    return { success: false, stale: true }
  }

  if (!subscription?.endpoint) return { success: false, stale: true }

  const result = await sendWebPush(subscription, JSON.stringify(payload), {
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    ttl: 86400,
    urgency: 'high',
  })

  return { success: result.success, stale: result.stale }
}

export async function dispatchNotifications(
  tokens: Array<{ id: string; token: string }>,
  payload: NotificationPayload,
  supabase: typeof supabaseAdmin
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

/**
 * Server-side helper to manually trigger an order alert.
 * Can be called from API routes, server actions, or checkout logic.
 */
export async function triggerOrderAlert(
  orderId: string,
  eventType: 'INSERT' | 'UPDATE',
  oldStatus?: string
) {
  // Fetch order details
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    console.error('[triggerOrderAlert] Order not found:', orderId)
    return { success: false, error: 'Order not found' }
  }

  const newStatus = order.status

  if (eventType === 'UPDATE' && oldStatus === newStatus) {
    return { success: false, message: 'Status unchanged' }
  }

  // Fan the same lifecycle event out to subscribed outbound webhooks.
  // Failures here must never affect push delivery or order processing.
  try {
    const { dispatchWebhookEvent } = await import('./webhooks.server')
    if (eventType === 'INSERT') {
      await dispatchWebhookEvent('order.created', order as Record<string, unknown>)
    } else {
      await dispatchWebhookEvent('order.status_changed', order as Record<string, unknown>, {
        old_status: oldStatus ?? null,
        new_status: newStatus,
      })
    }
  } catch (e) {
    console.error('[triggerOrderAlert] webhook dispatch failed', e)
  }

  const orderNum = order.order_number || order.id.slice(0, 8)
  
  let notif: NotificationPayload | null = null
  let target: 'admin_staff' | 'driver' | 'customer' | null = null
  
  if (eventType === 'INSERT' && newStatus === 'pending') {
    target = 'admin_staff'
    notif = {
      title: '🔔 New Order Received!',
      body: `Order #${orderNum} for ₹${order.total} (${order.payment_method || 'COD'}) is waiting for confirmation.`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-maskable-192.png',
      data: { url: '/admin/orders', order_id: order.id },
      tag: `new_order_${order.id}`,
    }
  } else if (eventType === 'UPDATE' && (newStatus === 'ready' || newStatus === 'packed')) {
    target = 'driver'
    notif = {
      title: '📦 Order Ready for Pickup!',
      body: `Order #${orderNum} is packed on ice and ready for dispatch.`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-maskable-192.png',
      data: { url: '/driver', order_id: order.id },
      tag: `packed_${order.id}`,
    }
  } else if (eventType === 'UPDATE' && newStatus === 'out_for_delivery') {
    target = 'customer'
    notif = {
      title: '🚚 Fresh Catch On the Way!',
      body: 'Your order is on the way with your delivery partner. Track live!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-maskable-192.png',
      data: { url: `/track/${order.id}`, order_id: order.id },
      tag: `delivery_${order.id}`,
    }
  } else if (eventType === 'UPDATE' && newStatus === 'delivered') {
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
    return { success: false, message: `Status '${newStatus}' not a notification trigger` }
  }
  
  const tokens = await getTargetTokens(supabaseAdmin, target, order.id, order.user_id)
  
  if (tokens.length === 0) {
    return { success: false, message: 'No registered tokens for target' }
  }
  
  await dispatchNotifications(tokens, notif, supabaseAdmin)
  
  return {
    success: true,
    target,
    status: newStatus,
    tokens_attempted: tokens.length,
  }
}
