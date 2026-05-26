// useAnimationStyle.ts
import { useMemo } from "react";
import type { Transition } from "framer-motion";
import { useReducedMotion } from "./useReducedMotion";

export function useAnimationStyle(style?: string): Transition {
  const reduced = useReducedMotion();

  return useMemo(() => {
    if (reduced) return { duration: 0 }; // disable animations
    switch (style) {
      case "energetic":
        return { type: "spring", stiffness: 300, damping: 20 };
      case "vibrant":
        return { type: "spring", stiffness: 200, damping: 25 };
      case "calm":
      default:
        return { type: "tween", duration: 0.5, ease: "easeInOut" };
    }
  }, [style, reduced]);
}