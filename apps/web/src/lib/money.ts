export function formatNaira(kobo: number | null | undefined): string {
  const n = Number(kobo ?? 0);
  return `₦${(n / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function labelStage(stage: string): string {
  return stage.replace(/_/g, " ");
}

export function labelWaiting(waitingOn: string): string {
  if (!waitingOn || waitingOn === "none") return "—";
  return waitingOn.replace(/_/g, " ");
}
