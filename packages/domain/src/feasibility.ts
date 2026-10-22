import { isNgHoliday } from "@mmabon/shared";

export type LeadTimeRule = {
  process: string;
  unitsPerDay: number;
  setupDays: number;
  artworkDays: number;
};

export function productionDaysNeeded(rules: LeadTimeRule[], qty: number): number {
  if (rules.length === 0) return 0;
  const processDays = rules.reduce((sum, r) => sum + Math.ceil(qty / r.unitsPerDay), 0);
  const setup = Math.max(...rules.map((r) => r.setupDays), 0);
  const artwork = Math.max(...rules.map((r) => r.artworkDays), 0);
  return processDays + setup + artwork;
}

export function availableWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const dow = cur.getUTCDay(); // 0 Sun
    const iso = cur.toISOString().slice(0, 10);
    if (dow !== 0 && !isNgHoliday(iso)) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export function isFeasible(
  rules: LeadTimeRule[],
  qty: number,
  today: Date,
  needBy: Date,
): { ok: boolean; needed: number; available: number } {
  const needed = productionDaysNeeded(rules, qty);
  const buffer = new Date(needBy);
  buffer.setUTCDate(buffer.getUTCDate() - 1);
  const available = availableWorkingDays(today, buffer);
  return { ok: available >= needed, needed, available };
}
