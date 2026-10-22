export type FollowupReason =
  | "awaiting_details"
  | "quote_no_reply"
  | "artwork_approval"
  | "balance_due"
  | "pickup"
  | "feedback"
  | "manual";

export function draftFollowupText(reason: FollowupReason, customerName: string): string {
  const name = customerName || "there";
  switch (reason) {
    case "awaiting_details":
      return `Hello ${name}, just checking in — we still need a few details to prepare your quote. Reply here when you can.`;
    case "quote_no_reply":
      return `Hello ${name}, following up on the quote we sent. Happy to adjust anything.`;
    case "artwork_approval":
      return `Hello ${name}, please confirm if the artwork looks good so we can proceed.`;
    case "balance_due":
      return `Hello ${name}, a balance remains on your order. Reply here if you need the payment link again.`;
    case "pickup":
      return `Hello ${name}, your order is ready for pickup.`;
    case "feedback":
      return `Hello ${name}, thanks for ordering with MMABON — any feedback for us?`;
    default:
      return `Hello ${name}, this is MMABON following up on your enquiry.`;
  }
}
