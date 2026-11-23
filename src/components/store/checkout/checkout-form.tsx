"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMoney } from "@/lib/money";
import { type CheckoutInput, checkoutSchema } from "@/lib/schemas/checkout";
import { startCheckoutAction } from "@/server/actions/checkout";
import { CartNotices } from "@/components/store/cart/cart-lines";
import type { CartView } from "@/server/services/cart";

type ShippingOption = { id: string; name: string; price: number; estimate: string | null };
type SavedAddress = { id: string; label: string; value: CheckoutInput["address"] };

// S9 checkout
export function CheckoutForm({
  cart,
  currency,
  shippingMethods,
  user,
  savedAddresses,
  taxAtPayment = false,
}: {
  cart: CartView;
  currency: string;
  /** Stripe Tax is on: sales tax is added on the payment page. */
  taxAtPayment?: boolean;
  shippingMethods: ShippingOption[];
  user: { email: string; name: string } | null;
  savedAddresses: SavedAddress[];
}) {
  const [error, setError] = useState<string | null>(null);
  const defaultAddress = savedAddresses[0]?.value;
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: user?.email ?? "",
      address: defaultAddress ?? {
        fullName: user?.name ?? "",
        phone: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "United States",
      },
      shippingMethodId: shippingMethods[0]?.id ?? "",
      saveAddress: false,
    },
  });
  const shippingId = useWatch({ control: form.control, name: "shippingMethodId" });
  const saveAddress = useWatch({ control: form.control, name: "saveAddress" });
  const shipping = shippingMethods.find((m) => m.id === shippingId);
  const total = cart.total + (shipping?.price ?? 0);
  const { errors, isSubmitting } = form.formState;
  const a = errors.address;

  async function onSubmit(values: CheckoutInput) {
    setError(null);
    const res = await startCheckoutAction(values);
    if (!res.ok) {
      setError(res.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.location.assign(res.data.url);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid gap-8 lg:grid-cols-[1fr_24rem]"
    >
      <div className="flex flex-col gap-8">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <CartNotices notices={cart.notices} />
        <fieldset className="flex flex-col gap-4">
          <legend className="font-heading mb-3 text-2xl">Contact</legend>
          {user ? (
            <p className="text-sm">
              Signed in as <strong>{user.email}</strong>
            </p>
          ) : (
            <>
              <TextField
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                description="We send your receipt and delivery updates here."
                error={errors.email?.message}
                {...form.register("email")}
              />
              <p className="text-muted-foreground text-sm">
                Have an account?{" "}
                <Link href="/login?next=/checkout" className="underline underline-offset-4">
                  Sign in
                </Link>{" "}
                or continue as a guest.
              </p>
            </>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="font-heading mb-3 text-2xl">Delivery address</legend>
          {savedAddresses.length > 1 ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Saved addresses
              <select
                className="bg-background h-9 rounded-lg border px-2 font-normal"
                onChange={(e) => {
                  const chosen = savedAddresses.find((s) => s.id === e.target.value);
                  if (chosen) form.reset({ ...form.getValues(), address: chosen.value });
                }}
              >
                {savedAddresses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <TextField
            id="fullName"
            label="Full name"
            autoComplete="name"
            error={a?.fullName?.message}
            {...form.register("address.fullName")}
          />
          <TextField
            id="phone"
            label="Phone"
            type="tel"
            autoComplete="tel"
            error={a?.phone?.message}
            {...form.register("address.phone")}
          />
          <TextField
            id="line1"
            label="Address line 1"
            autoComplete="address-line1"
            error={a?.line1?.message}
            {...form.register("address.line1")}
          />
          <TextField
            id="line2"
            label="Address line 2 (optional)"
            autoComplete="address-line2"
            error={a?.line2?.message}
            {...form.register("address.line2")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="city"
              label="Town or city"
              autoComplete="address-level2"
              error={a?.city?.message}
              {...form.register("address.city")}
            />
            <TextField
              id="state"
              label="State or region"
              autoComplete="address-level1"
              error={a?.state?.message}
              {...form.register("address.state")}
            />
            <TextField
              id="postalCode"
              label="ZIP or postal code"
              autoComplete="postal-code"
              error={a?.postalCode?.message}
              {...form.register("address.postalCode")}
            />
            <TextField
              id="country"
              label="Country"
              autoComplete="country-name"
              error={a?.country?.message}
              {...form.register("address.country")}
            />
          </div>
          {user ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!saveAddress}
                onCheckedChange={(c) => form.setValue("saveAddress", !!c)}
              />
              Save this address to my account
            </label>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="font-heading mb-3 text-2xl">Delivery</legend>
          {shippingMethods.length === 0 ? (
            <FormMessage>Delivery is not available right now. Please contact us.</FormMessage>
          ) : null}
          {shippingMethods.map((m) => (
            <label
              key={m.id}
              className="has-checked:border-primary has-checked:bg-secondary/40 flex cursor-pointer items-center gap-3 rounded-lg border p-3"
            >
              <input
                type="radio"
                value={m.id}
                {...form.register("shippingMethodId")}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">{m.name}</span>
                {m.estimate ? (
                  <span className="text-muted-foreground block text-xs">{m.estimate}</span>
                ) : null}
              </span>
              <span className="text-sm tabular-nums">
                {m.price === 0 ? "Free" : formatMoney(m.price, currency)}
              </span>
            </label>
          ))}
          {errors.shippingMethodId ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.shippingMethodId.message}
            </p>
          ) : null}
        </fieldset>
      </div>

      <aside
        className="bg-card flex h-fit flex-col gap-4 rounded-xl border p-5 lg:sticky lg:top-24"
        aria-label="Order summary"
      >
        <h2 className="font-heading text-2xl">Your order</h2>
        <ul className="flex flex-col gap-3">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 text-sm">
              <span className="bg-muted relative size-14 shrink-0 overflow-hidden rounded">
                {l.image ? (
                  <Image src={l.image.url} alt="" fill sizes="56px" className="object-cover" />
                ) : null}
                <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px]">
                  {l.quantity}
                </span>
              </span>
              <span className="flex-1">
                {l.productName}
                {l.variantLabel !== "Default" ? (
                  <span className="text-muted-foreground block text-xs">{l.variantLabel}</span>
                ) : null}
              </span>
              <span className="tabular-nums">{formatMoney(l.lineTotal, currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(cart.subtotal, currency)}</dd>
          </div>
          {cart.coupon ? (
            <div className="flex justify-between text-emerald-800">
              <dt>Discount ({cart.coupon.code})</dt>
              <dd className="tabular-nums">−{formatMoney(cart.discountTotal, currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="tabular-nums">
              {shipping
                ? shipping.price === 0
                  ? "Free"
                  : formatMoney(shipping.price, currency)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-medium">
            <dt>{taxAtPayment ? "Total before tax" : "Total"}</dt>
            <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
          </div>
        </dl>
        {taxAtPayment ? (
          <p className="text-muted-foreground text-xs">
            Sales tax, where it applies, is calculated from your delivery address and added on the
            payment page.
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="h-11 text-base"
          disabled={isSubmitting || shippingMethods.length === 0}
        >
          {isSubmitting ? "Starting payment…" : "Pay now"}
        </Button>
        <p className="text-muted-foreground text-xs">
          You will pay on a secure page.{taxAtPayment ? "" : " Prices include tax."}
        </p>
      </aside>
    </form>
  );
}
