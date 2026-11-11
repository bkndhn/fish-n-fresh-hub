/** Counter bills use assigned-driver handover; delivery orders retain PIN verification. */
export function isCounterHandover(fulfillmentType: string | null | undefined): boolean {
  return fulfillmentType === 'pos';
}