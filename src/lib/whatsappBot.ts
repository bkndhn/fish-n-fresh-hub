/** Pure helpers for the WhatsApp kitchen order bot (no server imports — testable). */

export interface BotProduct {
  id: string;
  name: string;
  price: number;
  unit: string | null;
}

export interface ParsedLine {
  product: BotProduct;
  qty: number;
  unit: string;
  lineTotal: number;
}

const UNIT_RE = /^(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|grams?|pcs?|pieces?|nos?|x)?\s*(.+)$/i;

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Finds the product whose name best matches the text (all product words, or the longest matching word). */
export function matchProduct(text: string, products: BotProduct[]): BotProduct | null {
  const t = norm(text);
  if (!t) return null;
  let best: BotProduct | null = null;
  let bestScore = 0;
  for (const p of products) {
    const words = norm(p.name).split(" ").filter((w) => w.length > 2);
    if (!words.length) continue;
    const hits = words.filter((w) => t.includes(w)).length;
    const score = hits / words.length;
    if (hits > 0 && score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

/** Parses "2kg Seer Fish, 500g Prawns, 1 Mango Shake" into priced lines. Grams convert to kg for kg-priced items. */
export function parseOrderText(message: string, products: BotProduct[]) {
  const lines: ParsedLine[] = [];
  const unmatched: string[] = [];
  for (const raw of message.split(/[,\n;]+| and /i)) {
    const part = raw.trim();
    if (!part) continue;
    const m = UNIT_RE.exec(part);
    let qty = 1;
    let unitWord = "";
    let name = part;
    if (m) {
      qty = Number(m[1]);
      unitWord = (m[2] || "").toLowerCase();
      name = m[3]!;
    }
    const product = matchProduct(name, products);
    if (!product || !(qty > 0)) {
      unmatched.push(part);
      continue;
    }
    const pUnit = (product.unit || "").toLowerCase();
    if (unitWord.startsWith("g") && pUnit.includes("kg")) qty = qty / 1000;
    qty = Math.min(qty, 100);
    lines.push({
      product,
      qty,
      unit: product.unit || "pc",
      lineTotal: Math.round(product.price * qty * 100) / 100,
    });
  }
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  return { lines, unmatched, subtotal };
}
