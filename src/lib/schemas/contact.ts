import { z } from "zod";

import { emailField } from "./auth";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: emailField,
  orderNumber: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v || null)
    .nullable(),
  subject: z.string().trim().min(1, "Enter a subject").max(150),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(5000),
  // Honeypot: real people leave this empty.
  website: z.string().max(0).optional().default(""),
});
export type ContactInput = z.input<typeof contactSchema>;
