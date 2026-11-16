/**
 * Content security policy and security headers (Phase 9).
 *
 * Scripts: 'unsafe-inline' is needed because pages are statically prerendered
 * (Partial Prerendering) and Next.js inlines bootstrap scripts; a nonce would
 * force every page to render per request. Everything else is locked to known origins.
 */
export function buildCsp(opts: {
  mediaUrl?: string;
  r2AccountId?: string;
  dev: boolean;
  https: boolean;
}) {
  const media = opts.mediaUrl ? new URL(opts.mediaUrl).origin : "";
  const r2 =
    opts.r2AccountId && opts.r2AccountId !== "placeholder"
      ? `https://${opts.r2AccountId}.r2.cloudflarestorage.com`
      : "https://*.r2.cloudflarestorage.com";
  const chat = {
    script: "https://embed.tawk.to https://*.tawk.to https://client.crisp.chat",
    connect: "https://*.tawk.to wss://*.tawk.to https://*.crisp.chat wss://*.crisp.chat",
    frame: "https://*.tawk.to https://*.crisp.chat",
    img: "https://*.tawk.to https://*.crisp.chat",
    style: "https://*.tawk.to https://client.crisp.chat",
    font: "https://*.tawk.to https://client.crisp.chat",
  };
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'unsafe-inline' ${opts.dev ? "'unsafe-eval'" : ""} ${chat.script}`,
    "style-src": `'self' 'unsafe-inline' ${chat.style}`,
    "img-src": `'self' data: blob: ${media} ${chat.img}`,
    "font-src": `'self' data: ${chat.font}`,
    "connect-src": `'self' ${r2} ${media} ${chat.connect} ${opts.dev ? "ws: wss:" : ""}`,
    "frame-src": chat.frame,
    "media-src": `'self' ${media}`,
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    ...(opts.https ? { "upgrade-insecure-requests": "" } : {}),
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`.replace(/\s+/g, " ").trim())
    .join("; ");
}

export function securityHeaders(opts: {
  mediaUrl?: string;
  r2AccountId?: string;
  dev: boolean;
  https: boolean;
}) {
  return [
    { key: "Content-Security-Policy", value: buildCsp(opts) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(!opts.https
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]),
  ];
}
