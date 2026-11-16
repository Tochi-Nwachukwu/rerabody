import type { NextConfig } from "next";

// Fail fast at startup if environment variables are missing or malformed.
import "./src/env";
import { securityHeaders } from "./src/lib/security-headers";

const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: mediaUrl ? [new URL(`${mediaUrl.replace(/\/$/, "")}/**`)] : [],
    // Local storage driver (dev and tests) serves uploads from this route.
    localPatterns: [{ pathname: "/api/uploads/local/**" }, { pathname: "/**", search: "" }],
  },
  poweredByHeader: false,
  async headers() {
    const headers = securityHeaders({
      mediaUrl,
      r2AccountId: process.env.R2_ACCOUNT_ID,
      dev: process.env.NODE_ENV === "development",
      https: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    });
    return [{ source: "/:path*", headers }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
