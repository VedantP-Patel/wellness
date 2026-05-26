// next.config.ts
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/worker/index.ts",
  swDest: "public/sw.js",
  // Optional: add files to precache
  // include: [/\.html$/, /\.js$/, /\.css$/],
});

const nextConfig: NextConfig = {
  // Removed the invalid experimental.turbo boolean.
  // Add any valid Next.js configuration here.
};

export default withSerwist(nextConfig);