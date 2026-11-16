import "server-only";

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/env";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";

export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: {
    // Let Prisma generate cuid() ids so every table uses the same format.
    database: { generateId: false },
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
      roleId: { type: "string", required: false, input: false },
      status: { type: "string", required: false, input: false, defaultValue: "ACTIVE" },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    async sendResetPassword({ user, url }) {
      // Not awaited, so response time does not reveal whether the account exists.
      void sendEmail({
        template: "password-reset",
        to: user.email,
        props: { name: user.name, url },
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    async sendVerificationEmail({ user, url }) {
      void sendEmail({ template: "verify-email", to: user.email, props: { name: user.name, url } });
    },
    async afterEmailVerification(user) {
      await sendEmail({
        template: "welcome",
        to: user.email,
        dedupeKey: `welcome:${user.id}`,
        props: { name: user.name },
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Accounts created through sign-up are always customers.
        async before(user) {
          return {
            data: { ...user, email: user.email.toLowerCase(), roleId: null, status: "ACTIVE" },
          };
        },
      },
    },
    session: {
      create: {
        // Deactivated users cannot start a session.
        async before(session) {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (!user || user.status === "DEACTIVATED") {
            throw new APIError("FORBIDDEN", { message: "This account has been deactivated." });
          }
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
