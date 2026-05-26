// next.config.mjs
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/worker/index.ts",
  swDest: "public/sw.js",
  // Optional: add files to precache
  // include: [/\.html$/, /\.js$/, /\.css$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack (we need webpack for Serwist)
  experimental: {
    turbo: false,
  },
  // other config...
};

export default withSerwist(nextConfig);