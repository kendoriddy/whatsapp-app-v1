export type AppRole = "admin" | "sales" | "designer" | "production" | "dispatch" | "manager";

export const SEND_ROLES: AppRole[] = ["admin", "sales", "manager"];

export type Capability =
  | "view_inbox"
  | "send_approve"
  | "submit_approval"
  | "assign"
  | "override_classification"
  | "orders_edit"
  | "orders_confirm"
  | "quotes_payments"
  | "manual_payment"
  | "see_prices"
  | "dashboard"
  | "pricing_rules"
  | "flags_automation_users"
  | "whatsapp_numbers"
  | "audit";

const matrix: Record<Capability, AppRole[]> = {
  view_inbox: ["admin", "sales", "designer", "production", "dispatch", "manager"],
  send_approve: ["admin", "sales", "manager"],
  submit_approval: ["admin", "sales", "designer", "production", "dispatch", "manager"],
  assign: ["admin", "sales", "manager"],
  override_classification: ["admin", "sales", "manager"],
  orders_edit: ["admin", "sales", "manager", "designer", "production", "dispatch"],
  orders_confirm: ["admin", "sales", "manager"],
  quotes_payments: ["admin", "sales", "manager"],
  manual_payment: ["admin", "manager"],
  see_prices: ["admin", "sales", "manager"],
  dashboard: ["admin", "manager", "sales"],
  pricing_rules: ["admin", "manager"],
  flags_automation_users: ["admin"],
  whatsapp_numbers: ["admin"],
  audit: ["admin", "manager"],
};

export function can(role: AppRole, capability: Capability): boolean {
  return matrix[capability].includes(role);
}

export function requireCapability(role: AppRole, capability: Capability): void {
  if (!can(role, capability)) {
    const err = new Error("FORBIDDEN");
    err.name = "FORBIDDEN";
    throw err;
  }
}

export { matrix as permissionMatrix };
