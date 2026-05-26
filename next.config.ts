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
  // Explicitly set an empty turbopack object to resolve the worker ambiguity
  // and allow Serwist's Webpack configuration to compile without exhausting retries.
  turbopack: {},
};

export default withSerwist(nextConfig);