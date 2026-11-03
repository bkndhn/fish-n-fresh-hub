export type WholesaleDeliveryMode = "pickup_only" | "free" | "charged";

/** Delivery charge for a bulk (trade) order. Fee > 0 overrides the normal shop fee. */
export function wholesaleDeliveryCharge(mode: string, wholesaleFee: number, normalFee: number): number {
  if (mode === "pickup_only" || mode === "free") return 0;
  return wholesaleFee > 0 ? wholesaleFee : normalFee;
}
