/**
 * Transactional Email Templates & Delivery Engine.
 * 
 * Generates responsive, high-converting HTML emails for:
 * 1. Order Confirmed (with PIN & items invoice)
 * 2. Out for Delivery (with driver name, phone, and live tracking)
 * 3. Order Delivered (with feedback link and quality guarantee)
 */

import { formatINR } from "./format";

export interface EmailOrderItem {
  name: string;
  qty: number;
  unit?: string;
  price: number;
  total: number;
  cuttingStyle?: string;
}

export interface OrderEmailData {
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  deliveryAddress?: string;
  deliverySlot?: string;
  deliveryPin?: string;
  driverName?: string;
  driverPhone?: string;
  items: EmailOrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  gstAmount: number;
  total: number;
  trackingUrl?: string;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
}

/**
 * 1. Order Confirmed Email Template
 */
export function buildOrderConfirmedEmail(data: OrderEmailData): string {
  const storeName = data.storeName || "Fish N Fresh";
  const trackingUrl = data.trackingUrl || `https://fishnfresh.in/track/${data.orderId}`;

  const itemRows = data.items
    .map(
      (it) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <div style="font-weight: 600; color: #0f172a;">${it.name}</div>
          ${it.cuttingStyle ? `<div style="font-size: 11px; color: #64748b;">Cut Style: ${it.cuttingStyle}</div>` : ""}
        </td>
        <td style="padding: 10px 0; text-align: center; border-bottom: 1px solid #f1f5f9; color: #475569;">
          ${it.qty} ${it.unit || "kg"}
        </td>
        <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #0f172a;">
          ${formatINR(it.total)}
        </td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed - ${storeName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${storeName}</h1>
              <p style="color: #e0f2fe; margin: 6px 0 0; font-size: 14px;">100% Harbour-Fresh Seafood Guaranteed</p>
            </td>
          </tr>

          <!-- Confirmation Banner -->
          <tr>
            <td style="padding: 30px 24px 20px;">
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 16px; font-weight: 700; color: #15803d; margin-bottom: 4px;">✅ Order #${data.orderNumber} Confirmed</div>
                <div style="font-size: 13px; color: #166534;">Hi ${data.customerName}, your seafood is being freshly prepped & iced!</div>
              </div>

              ${
                data.deliveryPin
                  ? `
              <!-- Delivery PIN Card -->
              <div style="background-color: #fefce8; border: 2px dashed #fde047; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; color: #854d0e;">Your Secret Delivery PIN</div>
                <div style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #ca8a04; margin: 6px 0;">${data.deliveryPin}</div>
                <div style="font-size: 11px; color: #a16207;">Share this 4-digit PIN with your delivery driver upon package handover.</div>
              </div>
              `
                  : ""
              }

              <!-- Delivery Slot Info -->
              ${
                data.deliverySlot
                  ? `
              <div style="font-size: 13px; color: #475569; margin-bottom: 20px; background-color: #f8fafc; border-radius: 8px; padding: 10px 14px;">
                ⏰ <strong>Expected Delivery:</strong> ${data.deliverySlot}
              </div>
              `
                  : ""
              }

              <!-- Items Table -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; font-size: 13px;">
                <thead>
                  <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 11px; text-transform: uppercase;">
                    <th align="left" style="padding-bottom: 8px;">Item Description</th>
                    <th align="center" style="padding-bottom: 8px;">Qty</th>
                    <th align="right" style="padding-bottom: 8px;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <!-- Financial Summary -->
              <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #475569; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 4px 0;">Subtotal</td>
                  <td align="right" style="font-weight: 600; color: #0f172a;">${formatINR(data.subtotal)}</td>
                </tr>
                ${
                  data.discount > 0
                    ? `
                <tr>
                  <td style="padding: 4px 0; color: #16a34a;">Discount</td>
                  <td align="right" style="font-weight: 600; color: #16a34a;">-${formatINR(data.discount)}</td>
                </tr>
                `
                    : ""
                }
                ${
                  data.deliveryFee > 0
                    ? `
                <tr>
                  <td style="padding: 4px 0;">Delivery & Handling</td>
                  <td align="right" style="font-weight: 600; color: #0f172a;">${formatINR(data.deliveryFee)}</td>
                </tr>
                `
                    : ""
                }
                <tr>
                  <td style="padding: 10px 0 0; font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #e2e8f0;">Total Paid / Payable</td>
                  <td align="right" style="padding: 10px 0 0; font-size: 18px; font-weight: 800; color: #0284c7; border-top: 2px solid #e2e8f0;">${formatINR(data.total)}</td>
                </tr>
              </table>

              <!-- Track Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${trackingUrl}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block;">
                  Track Live Delivery Status &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
              <div>${data.storeAddress || "Harbour Bypass Road, Thoothukudi - 628001"}</div>
              <div style="margin-top: 4px;">Need help? Call or WhatsApp <strong>${data.storePhone || "9843061919"}</strong></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 2. Out For Delivery Email Template
 */
export function buildOutForDeliveryEmail(data: OrderEmailData): string {
  const storeName = data.storeName || "Fish N Fresh";
  const trackingUrl = data.trackingUrl || `https://fishnfresh.in/track/${data.orderId}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Out for Delivery - ${storeName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800;">🚚 Your Fresh Seafood is on the Way!</h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #e0f2fe;">Order #${data.orderNumber} is out for delivery</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <p style="font-size: 14px; margin-top: 0;">Hi ${data.customerName},</p>
              <p style="font-size: 13px; color: #475569; line-height: 1.5;">
                Our delivery partner <strong>${data.driverName || "Express Rider"}</strong> has picked up your chilled seafood package and is heading towards your location.
              </p>

              ${
                data.driverPhone
                  ? `
              <div style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 16px; margin: 16px 0; font-size: 13px;">
                📞 <strong>Driver Contact:</strong> <a href="tel:${data.driverPhone}" style="color: #0284c7; font-weight: 700;">${data.driverPhone}</a>
              </div>
              `
                  : ""
              }

              ${
                data.deliveryPin
                  ? `
              <div style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 10px; padding: 12px 16px; text-align: center; margin: 16px 0;">
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #854d0e;">Handover PIN: <strong>${data.deliveryPin}</strong></div>
              </div>
              `
                  : ""
              }

              <div style="text-align: center; margin: 24px 0 12px;">
                <a href="${trackingUrl}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
                  View Live Map Tracking &rarr;
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 3. Order Delivered Email Template
 */
export function buildOrderDeliveredEmail(data: OrderEmailData): string {
  const storeName = data.storeName || "Fish N Fresh";
  const waHelp = `https://wa.me/${(data.storePhone || "919843061919").replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hi ${storeName}, feedback for delivered order #${data.orderNumber}: `
  )}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Delivered - ${storeName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="background-color: #15803d; padding: 28px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800;">🎉 Delivered Fresh to Your Door!</h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #dcfce7;">Order #${data.orderNumber} successfully completed</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <p style="font-size: 14px; margin-top: 0;">Hi ${data.customerName},</p>
              <p style="font-size: 13px; color: #475569; line-height: 1.5;">
                We hope your seafood arrived super fresh and expertly cleaned to your preference! Enjoy your healthy coastal meal.
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 12px; color: #64748b;">
                🛡️ <strong>Quality Assurance:</strong> If anything does not meet your freshness expectations, please report it within 60 minutes for an instant resolution or replacement.
              </div>

              <div style="text-align: center; margin: 24px 0 12px;">
                <a href="${waHelp}" style="background-color: #15803d; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
                  Share Feedback on WhatsApp &rarr;
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
