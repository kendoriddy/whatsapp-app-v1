/** Nigerian public holidays used by feasibility (Mon–Sat working days otherwise). */
export const NG_PUBLIC_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-03-30",
  "2026-04-03",
  "2026-05-01",
  "2026-06-12",
  "2026-06-16",
  "2026-06-17",
  "2026-10-01",
  "2026-12-25",
  "2026-12-26",
] as const;

export function isNgHoliday(isoDate: string): boolean {
  return (NG_PUBLIC_HOLIDAYS_2026 as readonly string[]).includes(isoDate);
}
