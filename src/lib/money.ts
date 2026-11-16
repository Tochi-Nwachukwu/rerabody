/**
 * Money is an integer in minor units everywhere (pence, cents, kobo).
 * Format only at the edge, with this helper.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function minorUnitDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export function formatMoney(amountMinor: number, currency: string, locale = "en-GB"): string {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`formatMoney expects an integer amount in minor units, got ${amountMinor}`);
  }
  const code = currency.toUpperCase();
  const cacheKey = `${locale}:${code}`;
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency: code });
    formatters.set(cacheKey, formatter);
  }
  return formatter.format(amountMinor / 10 ** minorUnitDigits(code));
}
