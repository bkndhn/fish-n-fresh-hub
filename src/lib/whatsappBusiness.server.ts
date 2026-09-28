import { formatWhatsAppPhone, getWhatsAppUrl } from './whatsapp';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type WhatsAppProvider =
  | 'meta_cloud'
  | 'interakt'
  | 'aisensy'
  | 'wati'
  | 'custom_webhook';

export interface WhatsAppConfig {
  provider: WhatsAppProvider;
  phoneNumberId?: string | undefined;
  wabaId?: string | undefined;
  accessToken?: string | undefined;
  webhookUrl?: string | undefined;
  templates?: {
    order_confirmed?: string | undefined;
    order_packed?: string | undefined;
    out_for_delivery?: string | undefined;
    otp_auth?: string | undefined;
  } | undefined;
}

export interface WhatsAppSendResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  fallbackUrl: string;
  error?: string;
}

export type WhatsAppNotificationType =
  | 'order_confirmed'
  | 'order_packed'
  | 'out_for_delivery'
  | 'otp_auth';

export interface WhatsAppNotificationPayload {
  recipientPhone: string;
  type: WhatsAppNotificationType;
  customerName?: string;
  orderNumber?: string;
  orderTotal?: string | number;
  trackUrl?: string;
  driverName?: string;
  otpCode?: string;
  customMessage?: string;
}

/**
 * Loads WhatsApp Business credentials from store database or environment variables.
 * Gracefully returns null if no valid credentials are found.
 */
export async function loadWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  // 1. Check environment variables first
  const envToken = process.env['WHATSAPP_ACCESS_TOKEN'] || process.env['WHATSAPP_API_KEY'];
  const envPhoneId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  const envWabaId = process.env['WHATSAPP_WABA_ID'];

  if (envToken && envPhoneId) {
    return {
      provider: 'meta_cloud',
      phoneNumberId: envPhoneId,
      wabaId: envWabaId,
      accessToken: envToken,
      templates: {
        order_confirmed: process.env['WHATSAPP_TEMPLATE_ORDER_CONFIRMED'] || 'order_confirmed',
        order_packed: process.env['WHATSAPP_TEMPLATE_ORDER_PACKED'] || 'order_packed',
        out_for_delivery: process.env['WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY'] || 'out_for_delivery',
        otp_auth: process.env['WHATSAPP_TEMPLATE_OTP_AUTH'] || 'otp_auth',
      },
    };
  }

  // 2. Query payment_gateway_credentials or store_settings
  try {
    const { data: creds } = await supabaseAdmin
      .from('payment_gateway_credentials')
      .select('provider, api_key, secret_key')
      .in('provider', ['whatsapp_business', 'meta_whatsapp', 'whatsapp'])
      .maybeSingle();

    if (creds) {
      let parsedSecret: any = {};
      if (creds.secret_key) {
        try {
          parsedSecret = JSON.parse(creds.secret_key);
        } catch {
          parsedSecret = { accessToken: creds.secret_key };
        }
      }

      const phoneNumberId = creds.api_key || parsedSecret.phoneNumberId || '';
      const accessToken = parsedSecret.accessToken || parsedSecret.token || '';

      if (phoneNumberId || accessToken) {
        return {
          provider: (parsedSecret.provider as WhatsAppProvider) || 'meta_cloud',
          phoneNumberId: phoneNumberId || undefined,
          wabaId: parsedSecret.wabaId || undefined,
          accessToken: accessToken || undefined,
          webhookUrl: parsedSecret.webhookUrl || undefined,
          templates: parsedSecret.templates || {
            order_confirmed: 'order_confirmed',
            order_packed: 'order_packed',
            out_for_delivery: 'out_for_delivery',
            otp_auth: 'otp_auth',
          },
        };
      }
    }
  } catch (dbErr) {
    console.warn('[WhatsApp Business] Warning checking DB credentials:', dbErr);
  }

  return null;
}

/**
 * Builds fallback plain text message suitable for wa.me links
 */
export function buildWhatsAppTextMessage(payload: WhatsAppNotificationPayload): string {
  const name = payload.customerName ? `Hi ${payload.customerName}! ` : 'Hi! ';
  switch (payload.type) {
    case 'order_confirmed':
      return `${name}Your order #${payload.orderNumber || ''} for ₹${payload.orderTotal || ''} is confirmed! Track live status: ${payload.trackUrl || ''}`;
    case 'order_packed':
      return `${name}Good news! Your order #${payload.orderNumber || ''} is fresh, packed on ice and ready for dispatch.`;
    case 'out_for_delivery':
      return `${name}Your fresh order #${payload.orderNumber || ''} is out for delivery with ${payload.driverName || 'our rider'}. Live tracking: ${payload.trackUrl || ''}`;
    case 'otp_auth':
      return `Your verification code is ${payload.otpCode || ''}. Please do not share this code with anyone.`;
    default:
      return payload.customMessage || `${name}Thank you for ordering with us!`;
  }
}

/**
 * Unified transactional WhatsApp dispatcher.
 * Safely inspects configuration: if credentials are missing, falls back to wa.me with zero errors.
 */
export async function sendWhatsAppNotification(
  payload: WhatsAppNotificationPayload
): Promise<WhatsAppSendResult> {
  const formattedPhone = formatWhatsAppPhone(payload.recipientPhone);
  const fallbackText = buildWhatsAppTextMessage(payload);
  const fallbackUrl = getWhatsAppUrl(formattedPhone, fallbackText);

  if (!formattedPhone) {
    return {
      success: false,
      reason: 'invalid_recipient_phone',
      fallbackUrl: '#',
    };
  }

  const config = await loadWhatsAppConfig();

  // Zero-key fallback mode
  if (!config || (!config.accessToken && !config.webhookUrl) || (!config.phoneNumberId && config.provider === 'meta_cloud')) {
    console.log('[WhatsApp API] Skipped: credentials not yet configured');
    return {
      success: false,
      skipped: true,
      reason: 'credentials_not_configured',
      fallbackUrl,
    };
  }

  try {
    if (config.provider === 'custom_webhook' && config.webhookUrl) {
      const resp = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
        },
        body: JSON.stringify({
          recipient: formattedPhone,
          notification: payload,
          message: fallbackText,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Custom webhook responded with status ${resp.status}`);
      }

      return {
        success: true,
        fallbackUrl,
      };
    }

    // Default: Meta Cloud API (Official)
    const templateName = config.templates?.[payload.type] || payload.type;
    const components: any[] = [];

    // Assemble template body parameters according to Meta API standard
    const bodyParameters: { type: string; text: string }[] = [];
    if (payload.customerName) {
      bodyParameters.push({ type: 'text', text: payload.customerName });
    }
    if (payload.orderNumber) {
      bodyParameters.push({ type: 'text', text: payload.orderNumber });
    }
    if (payload.orderTotal) {
      bodyParameters.push({ type: 'text', text: String(payload.orderTotal) });
    }
    if (payload.trackUrl) {
      bodyParameters.push({ type: 'text', text: payload.trackUrl });
    }
    if (payload.otpCode) {
      bodyParameters.push({ type: 'text', text: payload.otpCode });
    }

    if (bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParameters,
      });
    }

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en_US',
        },
        components: components.length > 0 ? components : undefined,
      },
    };

    const endpoint = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn('[WhatsApp Business API] Error response from Meta:', data);
      return {
        success: false,
        error: data?.error?.message || 'Meta API request failed',
        fallbackUrl,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    return {
      success: true,
      messageId,
      fallbackUrl,
    };
  } catch (err: any) {
    console.error('[WhatsApp Business API] Dispatch failed:', err);
    return {
      success: false,
      error: err.message || 'WhatsApp network error',
      fallbackUrl,
    };
  }
}
