/**
 * Variant generation from product options. Shared by the A5 editor and the
 * server, which re-validates the result before saving.
 */

export type OptionInput = { name: string; values: string[] };
export type OptionValues = Record<string, string>;

export type DraftVariant = {
  id?: string;
  optionValues: OptionValues;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  initialStock: number;
  stock?: number;
  lowStockThreshold: number;
  imageId: string | null;
  isActive: boolean;
};

/** Every combination of option values, in option order. No options gives one empty combination. */
export function combinations(options: OptionInput[]): OptionValues[] {
  return options.reduce<OptionValues[]>(
    (acc, option) =>
      acc.flatMap((combo) => option.values.map((value) => ({ ...combo, [option.name]: value }))),
    [{}],
  );
}

export function variantKey(values: OptionValues, optionNames: string[]): string {
  return optionNames.map((name) => `${name}=${values[name] ?? ""}`).join("|");
}

export function variantLabel(values: OptionValues | null | undefined): string {
  const parts = Object.values(values ?? {});
  return parts.length ? parts.join(" / ") : "Default";
}

function skuPart(value: string, max = 6) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(0, max);
}

export function suggestSku(base: string, values: OptionValues): string {
  const parts = [
    skuPart(base, 12) || "SKU",
    ...Object.values(values)
      .map((v) => skuPart(v))
      .filter(Boolean),
  ];
  return parts.join("-");
}

/**
 * Rebuilds the variant list after the options change. Variants whose option
 * values still exist are kept (with their id, price and stock); new
 * combinations get defaults; combinations that no longer exist are dropped.
 */
export function reconcileVariants(
  options: OptionInput[],
  existing: DraftVariant[],
  defaults: { skuBase: string; price: number },
): DraftVariant[] {
  const names = options.map((o) => o.name);
  const byKey = new Map(existing.map((v) => [variantKey(v.optionValues, names), v]));
  // With no options, keep the first existing variant as the default one.
  if (names.length === 0 && existing.length > 0 && !byKey.has(""))
    byKey.set("", { ...existing[0], optionValues: {} });

  return combinations(options).map((values) => {
    const match = byKey.get(variantKey(values, names));
    if (match) return { ...match, optionValues: values };
    return {
      optionValues: values,
      sku: suggestSku(defaults.skuBase, values),
      price: defaults.price,
      compareAtPrice: null,
      initialStock: 0,
      lowStockThreshold: 5,
      imageId: null,
      isActive: true,
    };
  });
}

/** Checks that variants are exactly the combinations of the options. Returns an error message or null. */
export function checkVariantsMatchOptions(
  options: OptionInput[],
  variants: { optionValues: OptionValues }[],
): string | null {
  const names = options.map((o) => o.name);
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length)
    return "Option names must be different.";
  for (const o of options) {
    if (o.values.length === 0) return `Add at least one value for ${o.name}.`;
    if (new Set(o.values.map((v) => v.toLowerCase())).size !== o.values.length)
      return `Values for ${o.name} must be different.`;
  }
  const expected = new Set(combinations(options).map((c) => variantKey(c, names)));
  const seen = new Set<string>();
  for (const v of variants) {
    const keys = Object.keys(v.optionValues);
    if (keys.length !== names.length || keys.some((k) => !names.includes(k)))
      return "Each variant must have a value for every option.";
    const key = variantKey(v.optionValues, names);
    if (!expected.has(key)) return "A variant uses an option value that does not exist.";
    if (seen.has(key)) return "Two variants have the same options.";
    seen.add(key);
  }
  if (seen.size !== expected.size) return "Every combination of options needs a variant.";
  return null;
}
