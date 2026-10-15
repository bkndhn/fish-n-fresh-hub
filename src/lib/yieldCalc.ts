export interface YieldInput {
  rawKg: number;
  costPerKg: number;
  cleanedKg: number;
  byproductRevenue?: number;
  sellingPrice?: number;
}

export interface YieldResult {
  totalRawCost: number;
  wasteKg: number;
  lossPct: number;
  trueCostPerKg: number;
  marginPerKg: number;
  marginPct: number;
  sellingAtLoss: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** True cost per cleaned kg after cutting loss, net of byproduct sales. */
export function calcYield(i: YieldInput): YieldResult | null {
  if (!(i.rawKg > 0) || !(i.cleanedKg > 0) || i.cleanedKg > i.rawKg || !(i.costPerKg >= 0)) return null;
  const totalRawCost = i.rawKg * i.costPerKg;
  const net = Math.max(0, totalRawCost - (i.byproductRevenue ?? 0));
  const trueCost = net / i.cleanedKg;
  const sp = i.sellingPrice ?? 0;
  const margin = sp - trueCost;
  return {
    totalRawCost: r2(totalRawCost),
    wasteKg: r2(i.rawKg - i.cleanedKg),
    lossPct: r2(((i.rawKg - i.cleanedKg) / i.rawKg) * 100),
    trueCostPerKg: r2(trueCost),
    marginPerKg: r2(margin),
    marginPct: sp > 0 ? r2((margin / sp) * 100) : 0,
    sellingAtLoss: sp > 0 && margin < 0,
  };
}

export const YIELD_PRESETS: { label: string; yieldPct: number }[] = [
  { label: "Seer Fish (steaks)", yieldPct: 72 },
  { label: "Pomfret (cleaned)", yieldPct: 78 },
  { label: "Prawns (peeled)", yieldPct: 57 },
  { label: "Mud Crab (cleaned)", yieldPct: 48 },
  { label: "Squid (cleaned)", yieldPct: 70 },
  { label: "Chicken (curry cut)", yieldPct: 70 },
  { label: "Mutton (curry cut)", yieldPct: 68 },
];
