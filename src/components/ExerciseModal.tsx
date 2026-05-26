// src/components/ExerciseModal.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ExerciseModalProps {
  open: boolean;
  onClose: () => void;
  task: any; // enriched planner task (includes exercise_id object)
  onComplete: (taskId: string) => Promise<void>;
}

export default function ExerciseModal({ open, onClose, task, onComplete }: ExerciseModalProps) {
  const [completing, setCompleting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState<boolean | null>(null);
  const [benefitRating, setBenefitRating] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);

  if (!task) return null;

  const exercise = task.exercise_id || {};
  const benefits = exercise.benefits || [];
  const targetAudience = exercise.target_audience || [];

  const handleComplete = async () => {
    setCompleting(true);
    await onComplete(task.id);
    setCompleting(false);
    setShowFeedback(true);
  };

  const submitFeedback = async () => {
    if (rating === null) return; // require thumbs up/down
    const res = await fetch("/api/planner/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: task.id,
        user_rating: rating,
        benefit_rating: benefitRating > 0 ? benefitRating : null,
      }),
    });
    if (res.ok) {
      setSubmitted(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">{exercise.name}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            {/* Benefits badge */}
            {benefits.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {benefits.slice(0, 3).map((b: string, i: number) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                    ⭐ {b}
                  </span>
                ))}
              </div>
            )}

            {/* Target audience */}
            {targetAudience.length > 0 && (
              <p className="mb-4 text-xs text-gray-500">
                Suitable for: {targetAudience.join(", ")}
              </p>
            )}

            {/* Suggestion reason */}
            {task.suggestion_reason?.reason && (
              <p className="mb-4 text-sm italic text-gray-600">💡 {task.suggestion_reason.reason}</p>
            )}

            {/* Complete button / Feedback */}
            {!task.completed && !showFeedback && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {completing ? "Completing..." : "Mark as Complete"}
              </button>
            )}

            {showFeedback && !submitted && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Was this exercise helpful?</p>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setRating(true)}
                    className={`flex-1 rounded-lg border py-2 text-sm ${
                      rating === true ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-gray-300"
                    }`}
                  >
                    👍 Helpful
                  </button>
                  <button
                    onClick={() => setRating(false)}
                    className={`flex-1 rounded-lg border py-2 text-sm ${
                      rating === false ? "border-red-400 bg-red-50 text-red-700" : "border-gray-300"
                    }`}
                  >
                    👎 Not helpful
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-gray-500">Benefit rating (1-5, optional)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={benefitRating || ""}
                    onChange={(e) => setBenefitRating(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1 text-sm"
                    placeholder="How effective? (1-5)"
                  />
                </div>

                <button
                  onClick={submitFeedback}
                  disabled={rating === null}
                  className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Submit Feedback
                </button>
              </div>
            )}

            {submitted && (
              <div className="mt-4 rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">
                Thanks! Your feedback helps improve future suggestions.
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}