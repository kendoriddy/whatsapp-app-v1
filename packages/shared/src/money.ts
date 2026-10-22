/** Store money as integer kobo. ₦1 = 100 kobo. */
export function nairaToKobo(naira: number): bigint {
  return BigInt(Math.round(naira * 100));
}

export function koboToNairaDisplay(kobo: bigint | number): string {
  const n = typeof kobo === "bigint" ? Number(kobo) : kobo;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(n / 100);
}
