/**
 * Stripe product tax codes offered in the category editor.
 *
 * Every id is copied exactly from Stripe's list (https://docs.stripe.com/tax/tax-codes).
 * Stripe treats them as opaque strings: never build or guess one. Which code is
 * legally right for a product is the store owner's (or their accountant's) call.
 */
export const TAX_CODES = [
  {
    id: "txcd_32050013",
    name: "Skin care products",
    hint: "Lotions, moisturisers and creams without a drug facts panel, e.g. body butters",
  },
  {
    id: "txcd_30011000",
    name: "Clothing and footwear",
    hint: "Apparel for general use, e.g. nightwear and loungewear",
  },
  {
    id: "txcd_99999999",
    name: "General tangible goods",
    hint: "Physical goods that fit no specific code",
  },
  { id: "txcd_00000000", name: "Nontaxable", hint: "No tax is applied anywhere" },
] as const;

export type TaxCodeId = (typeof TAX_CODES)[number]["id"];

export const TAX_CODE_IDS = TAX_CODES.map((c) => c.id) as [TaxCodeId, ...TaxCodeId[]];

/** Used for products whose category has no tax code. */
export const DEFAULT_PRODUCT_TAX_CODE: TaxCodeId = "txcd_99999999";

/** Stripe's "Shipping" code: delivery charged together with the goods. */
export const SHIPPING_TAX_CODE = "txcd_92010001";

export function taxCodeLabel(id: string | null | undefined): string {
  const code = TAX_CODES.find((c) => c.id === id);
  return code ? code.name : "Store default (general tangible goods)";
}
