// src/components/CatchUpPrompt.tsx
"use client";

interface CatchUpPromptProps {
  amount: number;
  reason: string;
  onLog: (amount: number) => void;
  onDismiss: () => void;
}

export default function CatchUpPrompt({ amount, reason, onLog, onDismiss }: CatchUpPromptProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Catch up on hydration
        </h2>
        <p className="text-sm text-gray-600 mb-2">{reason}</p>
        <p className="text-2xl font-bold text-emerald-600 mb-4">{amount} ml</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dismiss
          </button>
          <button
            onClick={() => onLog(amount)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Log {amount} ml
          </button>
        </div>
      </div>
    </div>
  );
}