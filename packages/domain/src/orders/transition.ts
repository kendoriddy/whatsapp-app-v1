import { AppError, ErrorCodes } from "@mmabon/shared";

export type OrderStage =
  | "new_enquiry"
  | "awaiting_details"
  | "quoted"
  | "negotiating"
  | "confirmed"
  | "paid"
  | "in_production"
  | "fulfilled"
  | "lost";

export type ActorKind = "staff" | "ai" | "system" | "customer";

const ALLOWED: Record<OrderStage, OrderStage[]> = {
  new_enquiry: ["awaiting_details", "quoted", "lost"],
  awaiting_details: ["quoted", "lost", "new_enquiry"],
  quoted: ["negotiating", "confirmed", "lost"],
  negotiating: ["quoted", "confirmed", "lost"],
  confirmed: ["paid", "lost"],
  paid: ["in_production", "lost"],
  in_production: ["fulfilled", "lost"],
  fulfilled: [],
  lost: ["new_enquiry"],
};

export function assertTransition(
  from: OrderStage,
  to: OrderStage,
  actor: ActorKind,
): void {
  if (actor === "ai" && (to === "confirmed" || to === "paid" || to === "fulfilled")) {
    throw new AppError(ErrorCodes.AI_TRANSITION_FORBIDDEN, "AI cannot set confirmed/paid/fulfilled", 422);
  }
  const allowed = ALLOWED[from];
  if (!allowed.includes(to)) {
    throw new AppError(ErrorCodes.CONFLICT, `Invalid transition ${from} → ${to}`, 409);
  }
}

export function nextOrderRef(year: number, seq: number): string {
  return `MMB-${year}-${String(seq).padStart(4, "0")}`;
}
