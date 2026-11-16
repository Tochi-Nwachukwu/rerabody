import { CartProvider } from "@/components/store/cart/cart-context";
import { CartButton, CartDrawer } from "@/components/store/cart/cart-drawer";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { env } from "@/env";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider currency={env.STORE_CURRENCY}>
      <Header cartSlot={<CartButton />} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer newsletterSlot={<NewsletterForm compact />} />
      <CartDrawer />
    </CartProvider>
  );
}
