"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import ProgressCircle from "./ProgressCircle";
import Avatar from "@/components/Avatar";
import { useWeather } from "@/hooks/useWeather";
import { computeAdjustedGoal } from "@/lib/adjustGoal";
import ExerciseModal from "@/components/ExerciseModal";

interface WaterEntry {
  id: string;
  amount_ml: number;
  logged_at: string;
}

interface PlannerTask {
  id: string;
  scheduled_time: string;
  amount_ml: number;
  task_type?: string;
  completed?: boolean;
  points_earned?: number;
  suggestion_reason?: any;
  exercise_id?: any;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [entries, setEntries] = useState<WaterEntry[]>([]);

  const [weightInput, setWeightInput] = useState("");
  const [loadingWeight, setLoadingWeight] = useState(false);
  const [logLoading, setLogLoading] = useState(false);

  // Planner
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>([]);
  const [exerciseTasks, setExerciseTasks] = useState<PlannerTask[]>([]);
  const [loadingPlanner, setLoadingPlanner] = useState(true);
  const [todayPoints, setTodayPoints] = useState(0);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Modal
  const [modalTask, setModalTask] = useState<PlannerTask | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Weather
  const [city, setCity] = useState("");
  const [showCityInput, setShowCityInput] = useState(false);
  const { weather, loading: weatherLoading } = useWeather(city);
  const [weatherAdjustEnabled, setWeatherAdjustEnabled] = useState(false);

  // Goals
  const baselineGoal = profile?.weight ? profile.weight * 30 : 2000;
  const dailyGoal = weather ? computeAdjustedGoal(baselineGoal, weather.temp, weather.humidity, weatherAdjustEnabled) : baselineGoal;
  const totalIntake = entries.reduce((s, e) => s + e.amount_ml, 0);
  const remaining = Math.max(dailyGoal - totalIntake, 0);
  const progressPercent = Math.min((totalIntake / dailyGoal) * 100, 100);

  useEffect(() => {
    setWeatherAdjustEnabled(profile?.weather_adjust_enabled ?? false);
  }, [profile]);

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/profile");
    if (res.ok) {
      const { profile } = await res.json();
      setProfile(profile);
      if (profile?.weight) setWeightInput(String(profile.weight));
    }
  }, []);

  const fetchPlanner = useCallback(async () => {
    setLoadingPlanner(true);
    try {
      const res = await fetch("/api/planner");
      if (!res.ok) return;
      const { tasks } = await res.json();
      setPlannerTasks(tasks.filter((t: any) => t.task_type === "hydration") || []);
      setExerciseTasks(tasks.filter((t: any) => t.task_type === "exercise") || []);
      const pts = tasks.reduce((sum: number, t: any) => sum + (t.points_earned || 0), 0);
      setTodayPoints(pts);
    } finally {
      setLoadingPlanner(false);
    }
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    // optimistic
    setPlannerTasks((p) => p.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
    setExerciseTasks((p) => p.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
    try {
      const res = await fetch(`/api/planner/${taskId}`, { method: "PATCH" });
      if (!res.ok) throw new Error("patch failed");
      await fetchPlanner();
    } catch {
      await fetchPlanner();
    }
  }, [fetchPlanner]);

  const regeneratePlanner = useCallback(async () => {
    await fetch("/api/planner/regenerate", { method: "POST" });
    fetchPlanner();
  }, [fetchPlanner]);

  const handleSuggestExercises = useCallback(async () => {
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/suggest-exercises", { method: "POST" });
      if (res.ok) await fetchPlanner();
    } finally {
      setSuggestLoading(false);
    }
  }, [fetchPlanner]);

  // initial client-only data
  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        setUser(data.user ?? null);
      } catch {
        setUser(null);
      }
      await fetchProfile();
      await fetchPlanner();
      const waterRes = await fetch("/api/water");
      if (waterRes.ok) {
        const { entries } = await waterRes.json();
        setEntries(entries || []);
      }
    };
    run();
  }, [fetchProfile, fetchPlanner]);

  const handleWeightSave = async () => {
    const weightNum = parseFloat(weightInput);
    if (isNaN(weightNum) || weightNum <= 0) return;
    setLoadingWeight(true);
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weight: weightNum }) });
      if (res.ok) {
        const { profile } = await res.json();
        setProfile(profile);
      }
    } finally {
      setLoadingWeight(false);
    }
  };

  const logWater = async (amount: number) => {
    const temp: WaterEntry = { id: `temp-${Date.now()}`, amount_ml: amount, logged_at: new Date().toISOString() };
    setEntries((p) => [temp, ...p]);
    setLogLoading(true);
    try {
      const res = await fetch("/api/water", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount_ml: amount }) });
      const data = await res.json();
      if (!res.ok) setEntries((p) => p.filter((e) => e.id !== temp.id));
      else {
        setEntries((p) => p.map((e) => (e.id === temp.id ? data.entry : e)));
        if (data.nap_suggestion) {
          // optionally handle
        }
        await fetchProfile();
        await fetchPlanner();
      }
    } catch {
      setEntries((p) => p.filter((e) => e.id !== temp.id));
    } finally {
      setLogLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Weight (kg):</label>
            <input type="number" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="70" min="1" />
            <button onClick={handleWeightSave} disabled={loadingWeight} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{loadingWeight ? "Saving…" : "Save"}</button>

            <div className="ml-auto flex items-center gap-3">
              <Avatar gender={profile?.gender} size={44} />
              <div>
                <p className="text-sm text-gray-600">Welcome back,</p>
                <p className="font-semibold text-gray-800">{user?.email?.split("@")[0] || "User"}</p>
              </div>
              {todayPoints > 0 && <span className="ml-4 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">{todayPoints} pts</span>}
            </div>
          </div>

          {/* Exercises */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-700">Today's Exercises</h2>
              <button onClick={handleSuggestExercises} disabled={suggestLoading} className="text-xs text-emerald-600 underline disabled:opacity-50">{suggestLoading ? "Generating..." : "Suggest"}</button>
            </div>

            {exerciseTasks.length === 0 ? (
              <p className="text-sm text-gray-400">No exercises suggested yet. Click "Suggest" to get personalised recommendations.</p>
            ) : (
              <div className="space-y-3">
                {exerciseTasks.map((task, idx) => (
                  <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className={`flex items-center gap-3 rounded-lg border p-3 ${task.completed ? "bg-gray-50 border-gray-200 opacity-70" : "bg-white border-emerald-200"}`}>
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold text-sm">{new Date(task.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{task.exercise_id?.name || 'Exercise'}</p>
                      {task.suggestion_reason?.reason && <p className="text-xs text-gray-500">{task.suggestion_reason.reason}</p>}
                      {task.completed && <p className="text-xs text-green-600">✓ Completed +{task.points_earned} pts</p>}
                    </div>
                    {!task.completed ? (
                      <div className="flex gap-2">
                        <button onClick={() => { setModalTask(task); setShowModal(true); }} className="text-xs text-emerald-600 underline">Details</button>
                        <button onClick={() => completeTask(task.id)} className="ml-auto flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors" aria-label="Complete exercise">✓</button>
                      </div>
                    ) : null}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Weather */}
          {weatherLoading && <p className="text-sm text-gray-400 mb-2">Loading weather…</p>}
          {weather && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-sky-50 p-3">
              <div className="flex items-center gap-2">
                <img src={`https://openweathermap.org/img/wn/${weather.icon}.png`} alt={weather.condition} className="w-10 h-10" />
                <div>
                  <p className="font-medium">{weather.temp}°C</p>
                  <p className="text-xs text-gray-500">{weather.condition}, {weather.humidity}% humidity</p>
                </div>
              </div>
              <button onClick={() => setShowCityInput((s) => !s)} className="text-xs text-blue-600 underline">{city || "Change city"}</button>
            </div>
          )}
          {showCityInput && (
            <div className="mb-4 flex gap-2">
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
              <button onClick={() => setShowCityInput(false)} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white">Set</button>
            </div>
          )}

          {/* Goal and progress */}
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-500">Daily Goal</p>
            <p className="text-2xl font-bold text-emerald-600">{dailyGoal} ml</p>
            {weather && weatherAdjustEnabled && <p className="text-xs text-gray-400">(baseline {baselineGoal} ml, adjusted for weather)</p>}
          </div>

          <div className="flex justify-center mb-6"><ProgressCircle percent={progressPercent} size={160} /></div>

          <div className="mb-4 flex justify-between text-sm"><span><span className="font-semibold">{totalIntake} ml</span> logged</span><span><span className="font-semibold">{remaining} ml</span> remaining</span></div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => logWater(250)} disabled={logLoading} className="flex-1 rounded-lg bg-blue-100 py-3 text-sm font-medium text-blue-700 hover:bg-blue-200 transition-colors">+250 ml</button>
            <button onClick={() => logWater(500)} disabled={logLoading} className="flex-1 rounded-lg bg-blue-100 py-3 text-sm font-medium text-blue-700 hover:bg-blue-200 transition-colors">+500 ml</button>
          </div>

          <CustomWaterInput onLog={logWater} loading={logLoading} />

          {/* Hydration plan */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-700">Today's Hydration Plan</h2>
              <button onClick={regeneratePlanner} className="text-xs text-emerald-600 underline">Regenerate</button>
            </div>

            {loadingPlanner ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : plannerTasks.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks scheduled. Set your wake and sleep times.</p>
            ) : (
              <div className="relative space-y-3">
                {plannerTasks.map((task, idx) => (
                  <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className={`flex items-center gap-3 rounded-lg border p-3 ${task.completed ? "bg-gray-50 border-gray-200 opacity-70" : "bg-white border-emerald-200"}`}>
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">{new Date(task.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="flex-1"><p className="font-medium text-sm">{task.amount_ml} ml</p>{task.completed && <p className="text-xs text-green-600">✓ Completed +{task.points_earned} pts</p>}</div>
                    {!task.completed && <button onClick={() => completeTask(task.id)} className="ml-auto flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors" aria-label="Complete hydration task">✓</button>}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recent entries */}
          {entries.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Today's Log</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {entries.map((entry) => (
                  <motion.div key={entry.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span>{entry.amount_ml} ml</span>
                    <span className="text-gray-400">{new Date(entry.logged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

        </motion.div>
      </div>

      {/* Exercise details modal */}
      {showModal && modalTask && (
        <ExerciseModal
          open={showModal}
          onClose={() => { setShowModal(false); setModalTask(null); }}
          task={modalTask}
          onComplete={async (taskId: string) => { await completeTask(taskId); setShowModal(false); setModalTask(null); }}
        />
      )}
    </main>
  );
}

// Custom water input component
function CustomWaterInput({ onLog, loading }: { onLog: (amount: number) => void; loading: boolean }) {
  const [customAmount, setCustomAmount] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(customAmount);
    if (amount > 0) {
      onLog(amount);
      setCustomAmount("");
    }
  };
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Custom ml" min="1" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      <button type="submit" disabled={loading || !customAmount} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50">Log</button>
    </form>
  );
}
