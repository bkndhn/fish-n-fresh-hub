import { createFileRoute } from '@tanstack/react-router'

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
        
        // Loaded lazily so notification code can never affect page routing.
        try {
          const { triggerOrderAlert } = await import('@/lib/order-alerts.server')
          const result = await triggerOrderAlert(
            payload.record.id,
            payload.type as 'INSERT' | 'UPDATE',
            payload.old_record?.status
          )
          return Response.json(result)
        } catch (err) {
          console.error('[order-alerts] dispatch failed:', err)
          return Response.json(
            { success: false, error: err instanceof Error ? err.message : 'Dispatch failed' },
            { status: 500 }
          )
        }
      },
    },
  },
})
