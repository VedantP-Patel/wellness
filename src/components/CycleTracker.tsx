// src/components/CycleTracker.tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CycleData {
  cycles: any[];
  prediction: {
    phase: string;
    day: number;
    nextPeriodPrediction: string;
  } | null;
  adjustments: {
    hydrationIncrease: number;
    exerciseIntensityModifier: number;
    tips: string[];
  };
}

export default function CycleTracker() {
  const [cycleData, setCycleData] = useState<CycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogForm, setShowLogForm] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flow, setFlow] = useState("medium");
  const [symptoms, setSymptoms] = useState<string[]>([]);

  const fetchCycle = async () => {
    setLoading(true);
    const res = await fetch("/api/cycle");
    if (res.ok) {
      const data = await res.json();
      setCycleData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCycle();
  }, []);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/cycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: startDate,
        end_date: endDate || null,
        flow,
        symptoms,
      }),
    });
    if (res.ok) {
      setShowLogForm(false);
      fetchCycle();
      // Reset form
      setStartDate(""); setEndDate(""); setFlow("medium"); setSymptoms([]);
    }
  };

  const phaseIcons: Record<string, string> = {
    menstrual: "🩸",
    follicular: "🌸",
    ovulatory: "☀️",
    luteal: "🍂",
  };

  const { prediction, adjustments } = cycleData || {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl bg-pink-50 p-4 border border-pink-200 mb-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-pink-700">Cycle Tracker</h3>
        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="text-xs text-pink-600 underline"
        >
          {showLogForm ? "Cancel" : "Log Period"}
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400 mt-2">Loading...</p>}

      {prediction && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-2xl">{phaseIcons[prediction.phase] || "⚪"}</span>
          <div>
            <p className="text-sm font-medium text-pink-700 capitalize">
              {prediction.phase} phase (day {prediction.day})
            </p>
            <p className="text-xs text-gray-500">
              Next period expected: {prediction.nextPeriodPrediction}
            </p>
          </div>
        </div>
      )}

      {adjustments && adjustments.tips.length > 0 && (
        <div className="mt-3 space-y-1">
          {adjustments.tips.map((tip, i) => (
            <p key={i} className="text-xs text-pink-600">💧 {tip}</p>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showLogForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleLog}
            className="mt-4 space-y-3 overflow-hidden"
          >
            <div>
              <label className="block text-xs font-medium text-gray-600">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Flow</label>
              <select
                value={flow}
                onChange={(e) => setFlow(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
                <option value="spotting">Spotting</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Symptoms (comma separated)</label>
              <input
                type="text"
                value={symptoms.join(", ")}
                onChange={(e) => setSymptoms(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                placeholder="cramps, fatigue..."
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded bg-pink-600 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-700"
            >
              Save
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}