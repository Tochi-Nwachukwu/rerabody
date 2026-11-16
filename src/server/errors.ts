/** An error whose message is safe to show to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN";

/** Thrown by session and permission checks. */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message = code === "UNAUTHENTICATED"
      ? "Please sign in."
      : "You do not have permission to do that.",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
