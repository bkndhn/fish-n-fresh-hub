import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Define the expected webhook payload from Supabase
interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: any
  old_record: any
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()

    // We only care about UPDATEs to the orders table
    if (payload.type !== 'UPDATE' || payload.table !== 'orders') {
      return new Response(JSON.stringify({ message: "Ignored" }), { status: 200 })
    }

    const newOrder = payload.record
    const oldOrder = payload.old_record

    // Check if status changed
    if (newOrder.status === oldOrder.status) {
      return new Response(JSON.stringify({ message: "Status unchanged" }), { status: 200 })
    }

    // We only trigger alerts for specific statuses
    if (!['shipped', 'delivered'].includes(newOrder.status)) {
      return new Response(JSON.stringify({ message: "Status doesn't require SMS" }), { status: 200 })
    }

    const customerPhone = newOrder.customer_phone
    const orderNumber = newOrder.order_number || newOrder.id.slice(0, 8)
    const customerName = newOrder.customer_name || 'Customer'

    if (!customerPhone) {
      return new Response(JSON.stringify({ error: "No customer phone number" }), { status: 400 })
    }

    let message = ''
    if (newOrder.status === 'shipped') {
      message = `Hi ${customerName}, your Fish N Fresh order #${orderNumber} has been shipped and is out for delivery! Track here: https://yourdomain.com/track/${newOrder.id}`
    } else if (newOrder.status === 'delivered') {
      message = `Hi ${customerName}, your Fish N Fresh order #${orderNumber} has been delivered. Enjoy your fresh catch!`
    }

    // ────────────────────────────────────────────────────────────────────────
    // 🔔 SMS / WHATSAPP PROVIDER INTEGRATION
    // ────────────────────────────────────────────────────────────────────────
    // You can choose which provider to use by setting environment variables
    // in your Supabase Dashboard -> Edge Functions -> Secrets.
    
    const provider = Deno.env.get('SMS_PROVIDER') || 'TWILIO' // 'TWILIO' or 'MSG91'

    if (provider === 'TWILIO') {
      // TWILIO INTEGRATION
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
      const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER')

      if (accountSid && authToken && fromPhone) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        
        const params = new URLSearchParams()
        params.append('To', customerPhone.startsWith('+') ? customerPhone : `+91${customerPhone}`)
        params.append('From', fromPhone)
        params.append('Body', message)

        await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })
      } else {
        console.log("Twilio credentials missing. Skipping SMS.")
      }

    } else if (provider === 'MSG91') {
      // MSG91 INTEGRATION (Standard Indian SMS provider)
      const authKey = Deno.env.get('MSG91_AUTH_KEY')
      const templateId = Deno.env.get('MSG91_TEMPLATE_ID')

      if (authKey && templateId) {
        const msg91Url = 'https://control.msg91.com/api/v5/flow/'
        
        await fetch(msg91Url, {
          method: 'POST',
          headers: {
            'authkey': authKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: templateId,
            short_url: "1",
            recipients: [
              {
                mobiles: customerPhone,
                name: customerName,
                order_id: orderNumber
              }
            ]
          }),
        })
      } else {
        console.log("MSG91 credentials missing. Skipping SMS.")
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Alert processed" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
