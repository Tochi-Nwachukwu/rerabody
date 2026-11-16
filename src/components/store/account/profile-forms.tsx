"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { passwordField } from "@/lib/schemas/auth";
import { updateProfileAction } from "@/server/actions/account";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  phone: z.string().trim().max(30),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// S22 profile, password and account deletion
export function ProfileForms({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  const router = useRouter();
  const profile = useForm<z.input<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name, phone },
  });
  const pw = useForm<z.input<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const [pwError, setPwError] = useState<string | null>(null);
  const [deletePw, setDeletePw] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-10">
      <form
        className="flex max-w-md flex-col gap-4"
        noValidate
        onSubmit={profile.handleSubmit(async (v) => {
          const res = await updateProfileAction(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Profile saved");
          router.refresh();
        })}
      >
        <h2 className="font-heading text-2xl">Profile</h2>
        <p className="text-muted-foreground text-sm">Email: {email}</p>
        <TextField
          id="p-name"
          label="Name"
          autoComplete="name"
          error={profile.formState.errors.name?.message}
          {...profile.register("name")}
        />
        <TextField
          id="p-phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          {...profile.register("phone")}
        />
        <Button type="submit" className="self-start" disabled={profile.formState.isSubmitting}>
          Save profile
        </Button>
      </form>

      <form
        className="flex max-w-md flex-col gap-4"
        noValidate
        onSubmit={pw.handleSubmit(async (v) => {
          setPwError(null);
          const { error } = await authClient.changePassword({
            currentPassword: v.currentPassword,
            newPassword: v.newPassword,
            revokeOtherSessions: true,
          });
          if (error)
            return setPwError(
              error.status === 400 || error.status === 401
                ? "Your current password is not right."
                : (error.message ?? "Could not change the password."),
            );
          pw.reset();
          toast.success("Password changed. Other devices were signed out.");
        })}
      >
        <h2 className="font-heading text-2xl">Change password</h2>
        {pwError ? <FormMessage>{pwError}</FormMessage> : null}
        <TextField
          id="pw-current"
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={pw.formState.errors.currentPassword?.message}
          {...pw.register("currentPassword")}
        />
        <TextField
          id="pw-new"
          label="New password"
          type="password"
          autoComplete="new-password"
          error={pw.formState.errors.newPassword?.message}
          {...pw.register("newPassword")}
        />
        <TextField
          id="pw-confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={pw.formState.errors.confirmPassword?.message}
          {...pw.register("confirmPassword")}
        />
        <Button type="submit" className="self-start" disabled={pw.formState.isSubmitting}>
          Change password
        </Button>
      </form>

      <form
        className="border-destructive/30 flex max-w-md flex-col gap-4 rounded-xl border p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setDeleteError(null);
          if (
            !window.confirm(
              "Delete your account? Your order history stays with the store, but you will lose access to it.",
            )
          )
            return;
          const { error } = await authClient.deleteUser({ password: deletePw, callbackURL: "/" });
          if (error) return setDeleteError(error.message ?? "Could not delete the account.");
          router.push("/");
          router.refresh();
        }}
      >
        <h2 className="font-heading text-2xl">Delete account</h2>
        <p className="text-muted-foreground text-sm">
          This removes your account, saved addresses and reviews. Orders are kept for the
          store&apos;s records.
        </p>
        {deleteError ? <FormMessage>{deleteError}</FormMessage> : null}
        <TextField
          id="del-pw"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={deletePw}
          onChange={(e) => setDeletePw(e.target.value)}
        />
        <Button type="submit" variant="destructive" className="self-start" disabled={!deletePw}>
          Delete my account
        </Button>
      </form>
    </div>
  );
}
