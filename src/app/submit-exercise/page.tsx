// src/app/submit-exercise/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function SubmitExercisePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("strength");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("none");
  const [family, setFamily] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [benefitsInput, setBenefitsInput] = useState(""); // comma separated
  const [audienceInput, setAudienceInput] = useState(""); // comma separated

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const benefits = benefitsInput.split(',').map(b => b.trim()).filter(Boolean);
    const audience = audienceInput.split(',').map(a => a.trim()).filter(Boolean);

    try {
      const res = await fetch('/api/exercises/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          muscle_group: muscleGroup,
          equipment_needed: equipment,
          family,
          difficulty,
          benefits,
          target_audience: audience,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.similar) {
          setMessage({
            type: 'error',
            text: `Duplicate detected. Similar exercises: ${data.similar.join(', ')}`,
          });
        } else {
          setMessage({ type: 'error', text: data.error || 'Submission failed' });
        }
      } else {
        setMessage({ type: 'success', text: 'Exercise submitted for review!' });
        // Optionally reset form
        setName(''); setMuscleGroup(''); setFamily('');
        setBenefitsInput(''); setAudienceInput('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Submit an Exercise</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="strength">Strength</option>
                <option value="cardio">Cardio</option>
                <option value="flexibility">Flexibility</option>
                <option value="balance">Balance</option>
                <option value="mindfulness">Mindfulness</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Muscle Group *</label>
              <input
                type="text"
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g., chest, back, legs"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Equipment *</label>
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="none">None</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="dumbbell">Dumbbell</option>
              <option value="barbell">Barbell</option>
              <option value="machine">Machine</option>
              <option value="cable">Cable</option>
              <option value="band">Band</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Family (e.g., squat, push-up) *</label>
            <input
              type="text"
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Difficulty (1-3) *</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value={1}>1 - Beginner</option>
              <option value={2}>2 - Intermediate</option>
              <option value={3}>3 - Advanced</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Benefits (comma separated, optional)
            </label>
            <input
              type="text"
              value={benefitsInput}
              onChange={(e) => setBenefitsInput(e.target.value)}
              placeholder="e.g., improves posture, reduces back pain"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Target Audience (comma separated, optional)
            </label>
            <input
              type="text"
              value={audienceInput}
              onChange={(e) => setAudienceInput(e.target.value)}
              placeholder="e.g., office workers, elderly"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {message && (
            <div
              className={`rounded-lg p-3 text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit for Review'}
          </button>
        </form>
      </motion.div>
    </main>
  );
}