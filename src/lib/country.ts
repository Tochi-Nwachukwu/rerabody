/**
 * Country names typed at checkout, resolved to ISO 3166-1 alpha-2 codes.
 * Stripe needs the code to work out sales tax; the address keeps the name the customer typed.
 */

const ALIASES: Record<string, string> = {
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  america: "US",
  "united states of america": "US",
  uk: "GB",
  "u.k.": "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
};

// Codes Intl knows that are not ISO 3166-1 countries (aliases such as UK, groupings,
// exceptional reservations and pseudo-locales). Stripe rejects them.
const NOT_COUNTRIES = new Set([
  "AC",
  "CP",
  "DG",
  "EA",
  "EU",
  "EZ",
  "IC",
  "QO",
  "TA",
  "UK",
  "UN",
  "XA",
  "XB",
  "ZZ",
]);

let byName: Map<string, string> | null = null;

function names(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (NOT_COUNTRIES.has(code)) continue;
      let name: string | undefined;
      try {
        name = display.of(code);
      } catch {
        continue;
      }
      // Unknown codes come back unchanged.
      if (name && name !== code) byName.set(normalise(name), code);
    }
  }
  return byName;
}

function normalise(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/^the /, "");
}

/** "United States", "USA" or "us" -> "US". Returns null when the country is not recognised. */
export function countryCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const n = normalise(input);
  if (!n) return null;
  if (ALIASES[n]) return ALIASES[n];
  if (/^[a-z]{2}$/.test(n)) {
    const upper = n.toUpperCase();
    return [...names().values()].includes(upper) ? upper : null;
  }
  return names().get(n) ?? null;
}
