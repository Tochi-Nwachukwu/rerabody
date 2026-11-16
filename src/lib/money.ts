/**
 * Money is an integer in minor units everywhere (pence, cents, kobo).
 * Format only at the edge, with this helper.
 */

const formatters = new Map<string, Intl.NumberFormat>();

export function minorUnitDigits(currency: string): number {
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

/** "18.50" -> 1850 for a two-decimal currency. Returns null when the text is not a valid amount. */
export function parseMoneyInput(text: string, currency: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned || !/^\d*(\.\d*)?$/.test(cleaned)) return null;
  const digits = minorUnitDigits(currency);
  const value = Math.round(Number(cleaned) * 10 ** digits);
  return Number.isFinite(value) ? value : null;
}

/** 1850 -> "18.50" for a two-decimal currency (no symbol). For input fields. */
export function toMoneyInput(amountMinor: number | null | undefined, currency: string): string {
  if (amountMinor === null || amountMinor === undefined) return "";
  const digits = minorUnitDigits(currency);
  return (amountMinor / 10 ** digits).toFixed(digits);
}
