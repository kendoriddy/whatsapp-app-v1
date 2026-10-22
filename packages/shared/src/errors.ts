export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCodes = {
  R2_NOT_APPROVED: "R2_NOT_APPROVED",
  R2_SETTING_DISABLED: "R2_SETTING_DISABLED",
  WINDOW_CLOSED: "WINDOW_CLOSED",
  SENDS_PAUSED: "SENDS_PAUSED",
  GROUNDING_FAILED: "GROUNDING_FAILED",
  AI_TRANSITION_FORBIDDEN: "AI_TRANSITION_FORBIDDEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
} as const;
