"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/server/actions/safe-action";
import {
  addToCartAction,
  applyCouponAction,
  getCartAction,
  removeCartItemAction,
  removeCouponAction,
  updateCartItemAction,
} from "@/server/actions/cart";
import type { CartView } from "@/server/services/cart";

type CartContextValue = {
  cart: CartView | null;
  currency: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  pending: boolean;
  refresh: () => void;
  add: (variantId: string, quantity: number) => Promise<boolean>;
  setQuantity: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ currency, children }: { currency: string; children: ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const accept = useCallback((res: ActionResult<CartView>) => {
    if (res.ok) setCart(res.data);
    else toast.error(res.error);
    return res.ok;
  }, []);

  const refresh = useCallback(
    () => start(async () => void accept(await getCartAction({}))),
    [accept],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      currency,
      open,
      setOpen,
      pending,
      refresh,
      async add(variantId, quantity) {
        const res = await addToCartAction({ variantId, quantity });
        if (!res.ok) {
          toast.error(res.error);
          return false;
        }
        setCart(res.data.cart);
        if (res.data.capped) toast.info("We added as many as are in stock.");
        setOpen(true);
        return true;
      },
      setQuantity(itemId, quantity) {
        start(async () => void accept(await updateCartItemAction({ itemId, quantity })));
      },
      remove(itemId) {
        start(async () => void accept(await removeCartItemAction({ itemId })));
      },
      async applyCoupon(code) {
        const res = await applyCouponAction({ code });
        if (res.ok) {
          setCart(res.data);
          return null;
        }
        return res.error;
      },
      removeCoupon() {
        start(async () => void accept(await removeCouponAction({})));
      },
    }),
    [cart, currency, open, pending, refresh, accept],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
