// src/hooks/useTone.ts
import { useMemo } from "react";

export function useTone(tonePreference?: string, cyclePhase?: string | null) {
  const getMessage = useMemo(
    () => (context: "hydration" | "exercise" | "general") => {
      // Auto‑override to gentle during menstrual/luteal
      const tone =
        cyclePhase === "menstrual" || cyclePhase === "luteal"
          ? "gentle"
          : tonePreference || "gentle";

      const messages: Record<string, Record<string, string>> = {
        motivational: {
          hydration: "Crush it! Stay hydrated!",
          exercise: "Push your limits!",
          general: "You've got this!",
        },
        gentle: {
          hydration: "Take care of yourself, sip by sip.",
          exercise: "Listen to your body today.",
          general: "You're doing great.",
        },
        informative: {
          hydration: "Water helps maintain focus and energy.",
          exercise: "Regular movement improves wellbeing.",
          general: "Stay consistent for best results.",
        },
      };

      return messages[tone]?.[context] || messages.gentle[context];
    },
    [tonePreference, cyclePhase]
  );

  return { getMessage };
}