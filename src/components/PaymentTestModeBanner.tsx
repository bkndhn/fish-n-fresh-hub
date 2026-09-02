const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        Online card payments are not configured yet. Use cash on delivery or UPI.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-center text-sm text-muted-foreground">
        Card payments are in test mode in the preview. Use card 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}
