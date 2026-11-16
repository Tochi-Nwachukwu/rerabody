import "server-only";

import { z } from "zod";

import { getSession, requirePermission } from "@/server/auth/session";
import { AuthError, UserError } from "@/server/errors";
import type { Permission } from "@/server/permissions";
import type { StaffContext } from "@/server/services/staff-access";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function failure(error: unknown): ActionResult<never> {
  if (error instanceof AuthError || error instanceof UserError)
    return { ok: false, error: error.message };
  throw error;
}

function invalid(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  const first = error.issues[0];
  return {
    ok: false,
    error: first
      ? `${first.path.join(".") ? `${first.path.join(".")}: ` : ""}${first.message}`
      : "Please check the form.",
    fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
  };
}

/**
 * Admin Server Action: parse input with Zod, check the session, check the
 * permission, then call the service (BUILD_PLAN section 4).
 */
export function adminAction<S extends z.ZodType, R>(
  permission: Permission,
  schema: S,
  handler: (input: z.output<S>, staff: StaffContext) => Promise<R>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    try {
      const staff = await requirePermission(permission);
      return { ok: true, data: await handler(parsed.data, staff) };
    } catch (error) {
      return failure(error);
    }
  };
}

/** Customer Server Action: parse input, require a signed-in user, call the service. */
export function userAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>, user: { id: string; email: string; name: string }) => Promise<R>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    try {
      const session = await getSession();
      if (!session) throw new AuthError("UNAUTHENTICATED");
      return { ok: true, data: await handler(parsed.data, session.user) };
    } catch (error) {
      return failure(error);
    }
  };
}

/** Public Server Action (no session needed): parse input, call the service. */
export function publicAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>) => Promise<R>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    try {
      return { ok: true, data: await handler(parsed.data) };
    } catch (error) {
      return failure(error);
    }
  };
}
