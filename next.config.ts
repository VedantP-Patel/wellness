import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set Turbopack root to this project to avoid incorrect root inference
  turbopack: {
    root: path.resolve(__dirname),
  } as any,
};

export default nextConfig;
