import type { NextConfig } from "next";

// Fail fast at startup if environment variables are missing or malformed.
import "./src/env";

const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: mediaUrl ? [new URL(`${mediaUrl.replace(/\/$/, "")}/**`)] : [],
    // Local storage driver (dev and tests) serves uploads from this route.
    localPatterns: [{ pathname: "/api/uploads/local/**" }, { pathname: "/**", search: "" }],
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
