export type GraphErrorKind = "retryable" | "terminal" | "ambiguous";

export function classifyGraphError(code: number | undefined): GraphErrorKind {
  if (code === undefined) return "ambiguous";
  if ([429, 130429, 131056].includes(code)) return "retryable";
  if ([190, 10, 200, 131031].includes(code)) return "terminal";
  if ([131047, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 132069, 100, 131008, 131009, 141006].includes(code)) {
    return "terminal";
  }
  return "retryable";
}

export const GRAPH_USER_MESSAGES: Record<number, string> = {
  131047: "The 24-hour window has closed. Choose an approved template.",
  141006: "WhatsApp billing is not set up. Add a payment method in WhatsApp Manager.",
  190: "WhatsApp access token is invalid. Rotate the system-user token.",
  131031: "WhatsApp account is restricted. Check Meta Business Suite.",
};
