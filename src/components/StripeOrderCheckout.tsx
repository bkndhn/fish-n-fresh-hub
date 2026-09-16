import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createOrderCheckout } from "@/lib/payments.functions";

export function StripeOrderCheckout({ orderId, returnUrl, guestPhone }: { orderId: string; returnUrl: string; guestPhone?: string }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createOrderCheckout({
      data: { orderId, returnUrl, environment: getStripeEnvironment(), guestPhone: guestPhone ?? localStorage.getItem("fnf_phone") ?? undefined },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Payment provider did not return a session");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="mt-4">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
