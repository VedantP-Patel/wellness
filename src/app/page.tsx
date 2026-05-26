// src/app/page.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-100 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl"
      >
        <h1 className="text-5xl font-extrabold text-slate-800 mb-4">
          Wellness Coach
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          Your smart hydration & exercise companion, tailored just for you.
        </p>
        <Link
          href="/auth"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-4 rounded-full shadow-lg transition-colors"
        >
          Get Started
        </Link>
      </motion.div>
    </main>
  );
}