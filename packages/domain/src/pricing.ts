export type PriceRule = {
  productCode: string;
  decoration: string | null;
  minQty: number;
  maxQty: number | null;
  unitKobo: number;
  addons: Record<string, number>;
  enabled: boolean;
};

export function priceLineItem(
  rules: PriceRule[],
  productCode: string,
  decoration: string | null,
  qty: number,
): { unitKobo: number; totalKobo: number; ruleIds: string[] } | null {
  const match = rules.find(
    (r) =>
      r.enabled &&
      r.productCode === productCode &&
      (r.decoration === null || r.decoration === decoration) &&
      qty >= r.minQty &&
      (r.maxQty === null || qty <= r.maxQty),
  );
  if (!match) return null;
  return {
    unitKobo: match.unitKobo,
    totalKobo: match.unitKobo * qty,
    ruleIds: [],
  };
}

export function quoteTotals(
  items: Array<{ totalKobo: number }>,
  deliveryKobo: number,
  discountKobo: number,
): { subtotalKobo: number; totalKobo: number } {
  const subtotalKobo = items.reduce((s, i) => s + i.totalKobo, 0);
  return { subtotalKobo, totalKobo: subtotalKobo + deliveryKobo - discountKobo };
}
