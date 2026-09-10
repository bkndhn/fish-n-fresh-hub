import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken =
  import.meta.env['VITE_STRIPE_PUBLISHABLE_KEY'] ||
  import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] ||
  "";

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  if (typeof window !== "undefined") {
    // Check localStorage in case store admin set it dynamically
    const adminKey = localStorage.getItem("fnf_stripe_publishable_key");
    if (adminKey?.startsWith("pk_test_")) return "sandbox";
    if (adminKey?.startsWith("pk_live_")) return "live";
  }
  return "sandbox";
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripeKey(): string {
  if (clientToken) return clientToken;
  if (typeof window !== "undefined") {
    const local = localStorage.getItem("fnf_stripe_publishable_key");
    if (local) return local;
  }
  return "";
}

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = getStripeKey();
    if (!key) {
      console.warn("Stripe Publishable Key not configured. Provide VITE_STRIPE_PUBLISHABLE_KEY or set in Store Settings.");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export function isPaymentsConfigured(): boolean {
  return Boolean(getStripeKey());
}

