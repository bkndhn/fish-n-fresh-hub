/**
 * Utility to generate direct, deep-linked WhatsApp URLs without requiring copy-pasting.
 * Handles Indian numbers (10 digits -> prepends 91), strips international formatting,
 * and encodes optional prefilled messages.
 */
export function formatWhatsAppPhone(phone: string): string {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  
  // If number starts with 0 (e.g. 09843061919), strip leading 0
  if (clean.startsWith("0")) {
    clean = clean.replace(/^0+/, "");
  }
  
  // If 10 digits (standard Indian mobile number), prepend 91
  if (clean.length === 10) {
    clean = `91${clean}`;
  }
  
  return clean;
}

export function getWhatsAppUrl(phone: string, message?: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) return "#";
  const baseUrl = `https://wa.me/${cleanPhone}`;
  if (message && message.trim()) {
    return `${baseUrl}?text=${encodeURIComponent(message.trim())}`;
  }
  return baseUrl;
}
