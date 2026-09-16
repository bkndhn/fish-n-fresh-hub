/**
 * @fileoverview Live Support Chat Configuration & Multi-Vertical Intelligence Engine
 * @module lib/liveChatConfig
 * 
 * Provides per-tenant / per-admin isolated customization for storefront live support:
 * - Dynamic assistant / desk name
 * - Vertical-tailored auto-replies (Seafood, Chicken/Meat, Grocery, Electronics, Fashion, etc.)
 * - Deep customization of freshness, cutting/packaging, GPS tracking, and delivery SLA replies
 * - Configurable 1-tap FAQ suggestion chips
 */

import type { BusinessVertical } from "./verticals";

export interface LiveChatFaq {
  q: string;
  a: string;
}

export interface LiveChatConfig {
  botName: string;
  welcomeMessage: string;
  supportPhone: string;
  whatsappNumber: string;
  freshnessReply: string;
  cutsReply: string;
  trackingReply: string;
  deliveryTimeReply: string;
  guaranteeReply: string;
  paymentReply: string;
  customFaqs: LiveChatFaq[];
}

/**
 * Generates industry-accurate, vertical-aware default replies so the live chat bot
 * never gives misleading seafood information for chicken, meat, or grocery stores.
 */
export function getDefaultLiveChatConfig(
  vertical: BusinessVertical = "seafood",
  storeName?: string | null,
  contactPhone?: string | null
): LiveChatConfig {
  const cleanName = storeName?.trim() || "Store";
  const cleanPhone = contactPhone?.trim() || "+91 98430 61919";

  switch (vertical) {
    case "chicken_meat":
    case "all_meat":
      return {
        botName: `${cleanName} Meat Desk`,
        welcomeMessage: `Vanakkam! 👋 Welcome to ${cleanName}. How can we assist you with your fresh farm chicken & tender meat order today?`,
        supportPhone: cleanPhone,
        whatsappNumber: cleanPhone,
        freshnessReply: `🍗 All our poultry and meat is 100% farm-fresh, procured daily from certified bio-secure farms. 100% hormone-free, antibiotic residue-free, and hygienically processed under strict cold-chain standards at 0–4°C.`,
        cutsReply: `🔪 Yes! We provide complimentary custom butcher cuts: Curry Cut, Biryani Cuts, Boneless Breast Fillets, Fry Chops, and Fine Kheema Mince at zero extra preparation charge.`,
        trackingReply: `📍 You can track your meat delivery rider in real time with our live GPS WebSocket radar and secure 4-digit Delivery PIN verification upon arrival.`,
        deliveryTimeReply: `⚡ Fresh butcher orders arrive within 30–45 minutes in insulated cold-lock thermal bags to ensure peak freshness! Morning (7 AM–10 AM) and evening slots are also available.`,
        guaranteeReply: `🛡️ 100% Tender & Fresh Guarantee! If quality, freshness, or cut does not meet your expectations, notify us within 2 hours of delivery for an immediate refund or replacement.`,
        paymentReply: `💳 We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD) at your doorstep.`,
        customFaqs: [
          {
            q: "Is the meat 100% farm-fresh & hygienic?",
            a: "🍗 Yes! Sourced daily from certified bio-secure farms, 100% hormone-free, antibiotic-free, and cut in chilled, sanitized facilities at 0–4°C.",
          },
          {
            q: "Can I choose custom cuts (curry/biryani/boneless)?",
            a: "🔪 Yes! Choose Curry Cut, Biryani Cuts, Boneless Fillets, or Fine Kheema Mince at ₹0 extra charge.",
          },
          {
            q: "How does live delivery tracking work?",
            a: "📍 You can track your rider in real time with our live GPS WebSocket radar and secure 4-digit Delivery PIN verification upon arrival.",
          },
          {
            q: "What is Express Delivery time?",
            a: "⚡ Express orders arrive in 30–45 minutes in insulated cold bags! Scheduled morning or evening delivery slots are also available.",
          },
          {
            q: "Can I order via WhatsApp?",
            a: `💬 Yes! Tap the WhatsApp button above or message ${cleanPhone} with live location autofill, instant bill calculation, and custom cut notes.`,
          },
          {
            q: "What payment methods are supported?",
            a: "💳 We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD).",
          },
        ],
      };

    case "grocery_supermarket":
      return {
        botName: `${cleanName} Mart Desk`,
        welcomeMessage: `Vanakkam! 👋 Welcome to ${cleanName}. How can we assist you with your fresh groceries & daily essentials today?`,
        supportPhone: cleanPhone,
        whatsappNumber: cleanPhone,
        freshnessReply: `🥦 All vegetables, greens, and fruits are procured fresh at dawn directly from regional farmer mandis. 100% clean, sorted, and zero artificial ripening agents.`,
        cutsReply: `📦 All fresh produce and staples are hygienically graded, weight-verified, and sealed in eco-friendly, food-grade packaging.`,
        trackingReply: `📍 Track your delivery rider on our live GPS map with real-time ETA and secure 4-digit Delivery PIN verification.`,
        deliveryTimeReply: `⚡ Express grocery delivery arrives within 30–45 minutes! You can also schedule convenient morning or evening home delivery slots at checkout.`,
        guaranteeReply: `🛡️ 100% Quality Guarantee: Not satisfied with any produce or grocery item? Contact us within 2 hours for an instant doorstep replacement or wallet refund.`,
        paymentReply: `💳 We accept UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD).`,
        customFaqs: [
          {
            q: "How fresh are the fruits & vegetables?",
            a: "🥦 Procured fresh daily at dawn from farmer mandis, graded, and packed with zero artificial ripening.",
          },
          {
            q: "How are products sorted and packaged?",
            a: "📦 Hygienically sorted, weight-verified, and sealed in eco-friendly food-grade packaging.",
          },
          {
            q: "How does live delivery tracking work?",
            a: "📍 Real-time GPS tracking with live rider location and secure 4-digit PIN verification upon arrival.",
          },
          {
            q: "What is Express Delivery time?",
            a: "⚡ 30–45 minutes express doorstep delivery in active zones! Scheduled slots are also available.",
          },
          {
            q: "Can I order via WhatsApp?",
            a: `💬 Yes! Tap the WhatsApp button above or message ${cleanPhone} with live location autofill & instant bill calculation.`,
          },
          {
            q: "What payment methods are supported?",
            a: "💳 We accept UPI (Google Pay, PhonePe, Paytm), Cards, NetBanking, and Cash on Delivery (COD).",
          },
        ],
      };

    case "electronics_appliances":
      return {
        botName: `${cleanName} Tech Desk`,
        welcomeMessage: `Hello! 👋 Welcome to ${cleanName}. How can we assist you with electronics, gadgets, or accessories today?`,
        supportPhone: cleanPhone,
        whatsappNumber: cleanPhone,
        freshnessReply: `✨ 100% Genuine, brand-authorized products with verified manufacturer warranty, serial numbers, and official GST invoices.`,
        cutsReply: `📦 Sealed retail packaging with tamper-proof security tape and bubble-wrap protective transport casing.`,
        trackingReply: `📍 Real-time shipment tracking with courier updates and secure OTP / Delivery PIN handover.`,
        deliveryTimeReply: `⚡ Same-day local delivery in select zones; express courier dispatch within 24 hours.`,
        guaranteeReply: `🛡️ 7-Day Replacement Guarantee against manufacturing defects, plus complete official brand warranty support.`,
        paymentReply: `💳 We accept UPI, Credit/Debit Cards, NetBanking, EMI options, and Cash on Delivery.`,
        customFaqs: [
          {
            q: "Are products authentic with brand warranty?",
            a: "✨ 100% genuine brand-authorized products with manufacturer warranty and GST invoice.",
          },
          {
            q: "What is the return & replacement policy?",
            a: "🛡️ 7-Day replacement guarantee on manufacturing defects, plus full official brand service center warranty.",
          },
          {
            q: "How does delivery tracking work?",
            a: "📍 Live parcel tracking with SMS/WhatsApp updates and secure PIN verification upon arrival.",
          },
          {
            q: "What is the delivery time?",
            a: "⚡ Same-day local express in active pincodes; fast dispatch within 24 hours for all orders.",
          },
          {
            q: "Can I order via WhatsApp?",
            a: `💬 Yes! Tap the WhatsApp button above or message ${cleanPhone} for instant quotes & product specs.`,
          },
          {
            q: "What payment methods are supported?",
            a: "💳 UPI, Credit/Debit Cards, NetBanking, and Cash on Delivery.",
          },
        ],
      };

    case "clothing_fashion":
    case "footwear":
      return {
        botName: `${cleanName} Style Desk`,
        welcomeMessage: `Hello! 👋 Welcome to ${cleanName}. Looking for sizes, styles, or order assistance?`,
        supportPhone: cleanPhone,
        whatsappNumber: cleanPhone,
        freshnessReply: `🧵 Premium quality fabrics and certified footwear craftsmanship with strict multi-point QC inspection before dispatch.`,
        cutsReply: `📦 Clean, garment-grade dustproof packaging with original brand tags and size labels intact.`,
        trackingReply: `📍 Real-time order tracking with SMS updates and secure PIN verification upon delivery.`,
        deliveryTimeReply: `⚡ Fast doorstep delivery within 24–48 hours with convenient time windows.`,
        guaranteeReply: `🛡️ 7-Day Hassle-Free Size Exchange & Returns if the fit isn't completely perfect.`,
        paymentReply: `💳 We accept UPI, Credit/Debit Cards, NetBanking, and Cash on Delivery.`,
        customFaqs: [
          {
            q: "What if the size doesn't fit?",
            a: "🛡️ We offer a 7-day hassle-free size exchange policy! We pick up and swap the size right at your doorstep.",
          },
          {
            q: "Are the fabrics & materials genuine?",
            a: "🧵 Yes! All apparel and footwear undergo strict multi-point quality inspection with verified authentic materials.",
          },
          {
            q: "How does delivery tracking work?",
            a: "📍 Real-time tracking with live status and 4-digit PIN verification upon arrival.",
          },
          {
            q: "What is the delivery time?",
            a: "⚡ Fast doorstep delivery within 24–48 hours in serviceable areas.",
          },
          {
            q: "Can I order via WhatsApp?",
            a: `💬 Yes! Tap the WhatsApp button or message ${cleanPhone} for personalized sizing & catalog lookbooks.`,
          },
          {
            q: "What payment methods are supported?",
            a: "💳 UPI, Cards, NetBanking, and Cash on Delivery.",
          },
        ],
      };

    case "seafood":
    default:
      return {
        botName: `${cleanName} Seafood Desk`,
        welcomeMessage: `Vanakkam! 👋 Welcome to ${cleanName}. How can we assist you with your fresh seafood catch today?`,
        supportPhone: cleanPhone,
        whatsappNumber: cleanPhone,
        freshnessReply: `🐟 All our seafood is 100% morning dock catch procured directly from Kasimedu & coastal harbours at 6:00 AM, stored strictly on chemical-free crushed ice at 0–4°C.`,
        cutsReply: `🔪 Yes! For every fish, you can choose Curry Cut, Fry Slices (Steaks), Whole Cleaned with Head, or Boneless Fillets at zero extra charge.`,
        trackingReply: `📍 You can track your rider in real time with our live GPS WebSocket radar and secure 4-digit Delivery PIN verification upon arrival.`,
        deliveryTimeReply: `⚡ Express deliveries arrive within 30–45 minutes in our service zones! You can also pick morning (7 AM–10 AM) or evening (4 PM–8 PM) slots at checkout.`,
        guaranteeReply: `🛡️ We offer a 100% Freshness Guarantee! If you are ever unhappy with freshness, notify us within 2 hours of delivery for an instant refund or replacement.`,
        paymentReply: `💳 We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD) at your doorstep.`,
        customFaqs: [
          {
            q: "How fresh is today's seafood?",
            a: "🐟 Morning dock catch procured directly from Kasimedu & coastal harbours at 6:00 AM, stored strictly on chemical-free crushed ice at 0–4°C.",
          },
          {
            q: "Can I choose my cutting style?",
            a: "🔪 Yes! For every fish, you can choose Curry Cut, Fry Slices (Steaks), Whole Cleaned with Head, or Boneless Fillets at zero extra charge.",
          },
          {
            q: "How does live delivery tracking work?",
            a: "📍 You can track your rider in real time with our live GPS WebSocket radar and secure 4-digit Delivery PIN verification upon arrival.",
          },
          {
            q: "What is Express Delivery time?",
            a: "⚡ Express deliveries arrive within 30–45 minutes in our active service zones! Morning or evening slots available at checkout.",
          },
          {
            q: "Can I order via WhatsApp?",
            a: `💬 Yes! Tap the WhatsApp button above or message ${cleanPhone} with live location autofill, instant bill calculation, and custom cut notes.`,
          },
          {
            q: "What payment methods are supported?",
            a: "💳 We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, and Cash on Delivery (COD).",
          },
        ],
      };
  }
}

import { getCurrentTenant } from "./tenant";

/**
 * Storage key helper for per-store / tenant isolation
 */
function getStorageKey(tenantId?: string | null): string {
  let id = tenantId?.trim();
  if (!id || id === "default") {
    try {
      id = getCurrentTenant().tenantId;
    } catch {
      id = "default";
    }
  }
  return `fnf_live_chat_cfg_${id || "default"}`;
}

/**
 * Retrieves saved live chat configuration for the active tenant/store.
 * Falls back to vertical-specific default if not customized yet.
 */
export function getSavedLiveChatConfig(
  vertical: BusinessVertical = "seafood",
  storeName?: string | null,
  contactPhone?: string | null,
  tenantId?: string | null
): LiveChatConfig {
  const defaults = getDefaultLiveChatConfig(vertical, storeName, contactPhone);
  if (typeof window === "undefined" || !window.localStorage) return defaults;

  try {
    let raw = tenantId ? localStorage.getItem(getStorageKey(tenantId)) : null;
    if (!raw) {
      try {
        const curTenant = getCurrentTenant().tenantId;
        raw = localStorage.getItem(getStorageKey(curTenant));
      } catch {
        // no-op
      }
    }
    if (!raw) {
      raw = localStorage.getItem("fnf_live_chat_cfg_default");
    }
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<LiveChatConfig>;
    return {
      botName: parsed.botName || defaults.botName,
      welcomeMessage: parsed.welcomeMessage || defaults.welcomeMessage,
      supportPhone: parsed.supportPhone || defaults.supportPhone,
      whatsappNumber: parsed.whatsappNumber || defaults.whatsappNumber,
      freshnessReply: parsed.freshnessReply || defaults.freshnessReply,
      cutsReply: parsed.cutsReply || defaults.cutsReply,
      trackingReply: parsed.trackingReply || defaults.trackingReply,
      deliveryTimeReply: parsed.deliveryTimeReply || defaults.deliveryTimeReply,
      guaranteeReply: parsed.guaranteeReply || defaults.guaranteeReply,
      paymentReply: parsed.paymentReply || defaults.paymentReply,
      customFaqs: Array.isArray(parsed.customFaqs) && parsed.customFaqs.length > 0 ? parsed.customFaqs : defaults.customFaqs,
    };
  } catch {
    return defaults;
  }
}

/**
 * Persists customized live chat configuration for the active tenant/store.
 */
export function saveLiveChatConfig(config: LiveChatConfig, tenantId?: string | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const key = getStorageKey(tenantId);
    localStorage.setItem(key, JSON.stringify(config));
    try {
      const curTenant = getCurrentTenant().tenantId;
      if (curTenant && curTenant !== tenantId) {
        localStorage.setItem(getStorageKey(curTenant), JSON.stringify(config));
      }
    } catch {
      // no-op
    }
  } catch (err) {
    console.warn("[LiveChatConfig] Failed to save config to localStorage:", err);
  }
}

/**
 * Intelligent intent matching engine that resolves customer questions:
 * 1. Checks configured custom FAQ question matches
 * 2. Checks intent categories (cuts, freshness, tracking, delivery speed, whatsapp, payments, guarantees)
 * 3. Uses customized replies from the active store's config
 */
export function resolveLiveChatAutoReply(
  text: string,
  config?: LiveChatConfig | null,
  vertical: BusinessVertical = "seafood",
  storeName?: string | null
): string {
  const activeCfg = config || getDefaultLiveChatConfig(vertical, storeName);
  const t = text.toLowerCase().trim();

  // 1. Direct match with custom FAQ questions
  for (const faq of activeCfg.customFaqs) {
    if (faq.q.toLowerCase() === t) {
      return faq.a;
    }
  }

  // 2. Cutting styles, butchery, sizing, packaging
  if (
    t.includes("cut") ||
    t.includes("style") ||
    t.includes("clean") ||
    t.includes("slice") ||
    t.includes("fillet") ||
    t.includes("curry") ||
    t.includes("steak") ||
    t.includes("piece") ||
    t.includes("kheema") ||
    t.includes("mince") ||
    t.includes("size") ||
    t.includes("fit")
  ) {
    return activeCfg.cutsReply;
  }

  // 3. Freshness, sourcing, quality, hygiene, organic
  if (
    t.includes("fresh") ||
    t.includes("catch") ||
    t.includes("today") ||
    t.includes("harbour") ||
    t.includes("harbor") ||
    /\bice\b/.test(t) ||
    t.includes("chemical") ||
    t.includes("farm") ||
    t.includes("halal") ||
    t.includes("hygien") ||
    t.includes("authentic") ||
    t.includes("organic")
  ) {
    return activeCfg.freshnessReply;
  }

  // 4. Live GPS tracking, rider location, Delivery PIN
  if (
    t.includes("track") ||
    t.includes("pin") ||
    t.includes("rider") ||
    t.includes("gps") ||
    t.includes("where is") ||
    t.includes("location") ||
    t.includes("nav") ||
    t.includes("driver")
  ) {
    return activeCfg.trackingReply;
  }

  // 5. Express delivery speed, slot timing, delivery hours
  if (
    t.includes("express") ||
    t.includes("fast") ||
    t.includes("timing") ||
    t.includes("slot") ||
    t.includes("delivery time") ||
    t.includes("quick") ||
    t.includes("how long") ||
    t.includes("when will")
  ) {
    return activeCfg.deliveryTimeReply;
  }

  // 6. WhatsApp ordering & direct contact
  if (
    t.includes("whatsapp") ||
    /\bwa\b/.test(t) ||
    t.includes("phone") ||
    t.includes("call") ||
    t.includes("contact") ||
    t.includes("number") ||
    t.includes("desk")
  ) {
    return `💬 You can also order directly via WhatsApp or speak to our ${activeCfg.botName} at ${activeCfg.supportPhone} with live location autofill & custom requests!`;
  }

  // 7. Payment methods & COD
  if (
    t.includes("pay") ||
    t.includes("payment") ||
    t.includes("cod") ||
    t.includes("cash") ||
    t.includes("upi") ||
    t.includes("gpay") ||
    t.includes("phonepe") ||
    t.includes("card")
  ) {
    return activeCfg.paymentReply;
  }

  // 8. Refunds, replacement, complaints & guarantees
  if (
    t.includes("refund") ||
    t.includes("return") ||
    t.includes("bad") ||
    t.includes("smell") ||
    t.includes("spoil") ||
    t.includes("cancel") ||
    t.includes("guarantee") ||
    t.includes("replace")
  ) {
    return activeCfg.guaranteeReply;
  }

  // 9. Pricing, offers, discounts
  if (
    t.includes("price") ||
    t.includes("rate") ||
    t.includes("cost") ||
    t.includes("offer") ||
    t.includes("discount") ||
    t.includes("deal")
  ) {
    return `🏷️ Our prices are updated daily to provide verified direct market pricing. Check our Catalog tab for today's special deals and bundle discounts!`;
  }

  // 10. Fallback with active bot name and support lines
  return `🙏 Thank you for contacting ${activeCfg.botName}! Our team has received your inquiry. For immediate telephone assistance, tap the WhatsApp or Call button at the top or reach us at ${activeCfg.supportPhone}.`;
}
