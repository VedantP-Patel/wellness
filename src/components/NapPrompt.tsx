// src/components/NapPrompt.tsx
"use client";

import { useState } from "react";

interface NapPromptProps {
  onConfirm: (minutes: number) => void;
  onDismiss: () => void;
}

export default function NapPrompt({ onConfirm, onDismiss }: NapPromptProps) {
  const [duration, setDuration] = useState(30);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Did you just take a nap?</h2>
        <p className="text-sm text-gray-600 mb-4">
          We noticed a gap in your activity. Log a nap to keep your wellness data accurate.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={10}
            max={180}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            No, skip
          </button>
          <button
            onClick={() => onConfirm(duration)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Yes, I napped
          </button>
        </div>
      </div>
    </div>
  );
}