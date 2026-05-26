// src/app/admin/AdminDashboard.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"pending" | "edit" | "sync" | "analytics">("pending");

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b pb-2">
          {(["pending", "edit", "sync", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                activeTab === tab
                  ? "bg-white text-emerald-700 border-b-2 border-emerald-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab === "pending" && "Pending Submissions"}
              {tab === "edit" && "Edit Exercises"}
              {tab === "sync" && "Sync & Generate"}
              {tab === "analytics" && "Analytics"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          {activeTab === "pending" && <PendingSubmissions />}
          {activeTab === "edit" && <EditExercises />}
          {activeTab === "sync" && <SyncGenerate />}
          {activeTab === "analytics" && <Analytics />}
        </motion.div>
      </div>
    </main>
  );
}

// --- Sub-components ---

function PendingSubmissions() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/exercises/pending");
    if (res.ok) {
      const data = await res.json();
      setExercises(data.exercises || []);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    await fetch(`/api/admin/exercises/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: true }),
    });
    fetchPending();
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/admin/exercises/${id}`, { method: "DELETE" });
    fetchPending();
  };

  if (loading) return <p>Loading...</p>;
  if (exercises.length === 0) return <p className="text-gray-500">No pending submissions.</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Pending Exercise Submissions</h2>
      <div className="space-y-3">
        {exercises.map((ex) => (
          <div key={ex.id} className="border rounded p-4">
            <p className="font-medium">{ex.name}</p>
            <p className="text-sm text-gray-500">{ex.category} · {ex.muscle_group}</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleApprove(ex.id)}
                className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(ex.id)}
                className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditExercises() {
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.trim().length > 1) {
      fetchExercises();
    }
  }, [search]);

  const fetchExercises = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/exercises/search?q=${encodeURIComponent(search)}`);
    if (res.ok) {
      const data = await res.json();
      setExercises(data.exercises || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    await fetch(`/api/admin/exercises/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        benefits: selected.benefits,
        target_audience: selected.target_audience,
        impact_level: selected.impact_level,
      }),
    });
    alert("Updated!");
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Edit Exercise Metadata</h2>
      <input
        type="text"
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm mb-4"
      />
      {loading && <p>Searching...</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              onClick={() => setSelected(ex)}
              className={`cursor-pointer border rounded p-2 text-sm ${selected?.id === ex.id ? "border-emerald-500 bg-emerald-50" : ""}`}
            >
              {ex.name}
            </div>
          ))}
        </div>
        {selected && (
          <div className="border rounded p-4">
            <h3 className="font-medium">{selected.name}</h3>
            <label className="block text-xs font-medium mt-2">Benefits (comma separated)</label>
            <input
              type="text"
              value={selected.benefits?.join(", ") || ""}
              onChange={(e) =>
                setSelected({ ...selected, benefits: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })
              }
              className="w-full rounded border px-2 py-1 text-sm mt-1"
            />
            <label className="block text-xs font-medium mt-2">Target Audience (comma separated)</label>
            <input
              type="text"
              value={selected.target_audience?.join(", ") || ""}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  target_audience: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                })
              }
              className="w-full rounded border px-2 py-1 text-sm mt-1"
            />
            <label className="block text-xs font-medium mt-2">Impact Level (1-10)</label>
            <input
              type="number"
              value={selected.impact_level || ""}
              onChange={(e) => setSelected({ ...selected, impact_level: Number(e.target.value) })}
              className="w-full rounded border px-2 py-1 text-sm mt-1"
              min={1}
              max={10}
            />
            <button
              onClick={handleSave}
              className="mt-3 w-full rounded bg-emerald-600 py-1.5 text-sm text-white hover:bg-emerald-700"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SyncGenerate() {
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const handleSync = async () => {
    setSyncing(true);
    const res = await fetch("/api/sync-exercises", { method: "POST" });
    const data = await res.json();
    setMessage(data.message || data.error || "Sync completed");
    setSyncing(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch("/api/generate-variations", { method: "POST" });
    const data = await res.json();
    setMessage(data.message || data.error || "Generation completed");
    setGenerating(false);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Manual Sync & Variation Generation</h2>
      <div className="flex gap-4">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Exercises from API"}
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {generating ? "Generating..." : "Generate Variations"}
        </button>
      </div>
      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
    </div>
  );
}

function Analytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading analytics...</p>;
  if (!data) return <p>No data.</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Analytics</h2>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-600">Top Benefits Suggested</h3>
        <ul className="list-disc list-inside text-sm">
          {data.topBenefits?.map((b: any) => (
            <li key={b.name}>{b.name} (used {b.count} times)</li>
          ))}
        </ul>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-600">Popular Exercises (by completions)</h3>
        <ul className="list-disc list-inside text-sm">
          {data.popularExercises?.map((ex: any) => (
            <li key={ex.exercise_id}>{ex.exercise_id} – {ex.count} completions</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-600">Feedback Summary</h3>
        <p className="text-sm">Total ratings: {data.feedback?.total}</p>
        <p className="text-sm">Helpful: {data.feedback?.helpful} | Not helpful: {data.feedback?.unhelpful}</p>
      </div>
    </div>
  );
}