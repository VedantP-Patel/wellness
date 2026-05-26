// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import Avatar from "@/components/Avatar";
import ProgressCircle from "./ProgressCircle";
import Skeleton from "@/components/Skeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useWeather } from "@/hooks/useWeather";
import { computeAdjustedGoal } from "@/lib/adjustGoal";
import { useAnimationStyle } from "@/hooks/useAnimationStyle";
import { useTone } from "@/hooks/useTone";

// Dynamic imports for modals and heavy components
const ExerciseModal = dynamic(() => import("@/components/ExerciseModal"), {
  ssr: false,
});
const NapPrompt = dynamic(() => import("@/components/NapPrompt"), {
  ssr: false,
});
const CatchUpPrompt = dynamic(() => import("@/components/CatchUpPrompt"), {
  ssr: false,
});
const CycleTracker = dynamic(() => import("@/components/CycleTracker"), {
  ssr: false,
});
const BadgeGallery = dynamic(() => import("@/components/BadgeGallery"), {
  ssr: false,
});

interface WaterEntry {
  id: string;
  amount_ml: number;
  logged_at: string;
}

// Sortable task row component (unchanged)
function SortableTask({
  task,
  onComplete,
  onOpenModal,
}: {
  task: any;
  onComplete: (id: string) => void;
  onOpenModal: (task: any) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isHydration = task.task_type === "hydration";
  const isCompleted = task.completed;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        isCompleted
          ? "bg-gray-50 border-gray-200 opacity-70"
          : "bg-white border-emerald-200"
      }`}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        className={`cursor-grab text-gray-400 hover:text-gray-600 ${
          isCompleted ? "pointer-events-none opacity-30" : ""
        }`}
        aria-label="Drag to reorder"
        disabled={isCompleted}
      >
        ≡
      </button>

      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
        {format(new Date(task.scheduled_time), "HH:mm")}
      </div>

      <div className="flex-1">
        <p className="font-medium text-sm">
          {isHydration
            ? `${task.amount_ml} ml`
            : task.exercise_id?.name || "Exercise"}
        </p>
        {!isHydration && task.suggestion_reason?.reason && (
          <p className="text-xs text-gray-500">
            {task.suggestion_reason.reason}
          </p>
        )}
        {isCompleted && (
          <p className="text-xs text-green-600">
            ✓ Completed +{task.points_earned} pts
          </p>
        )}
      </div>

      {!isCompleted &&
        (isHydration ? (
          <button
            onClick={() => onComplete(task.id)}
            className="ml-auto flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700"
            aria-label="Complete hydration task"
          >
            ✓
          </button>
        ) : (
          <button
            onClick={() => onOpenModal(task)}
            className="ml-auto flex-shrink-0 text-xs text-emerald-600 underline"
          >
            Details
          </button>
        ))}
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // -------------------- State --------------------
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [loadingWeight, setLoadingWeight] = useState(false);

  // Wake / sleep / nap
  const [wakeTime, setWakeTime] = useState<number | null>(null);
  const [sleepTime, setSleepTime] = useState<number | null>(null);
  const [napMinutes, setNapMinutes] = useState(0);
  const [editWake, setEditWake] = useState(false);
  const [editSleep, setEditSleep] = useState(false);
  const [showNapPrompt, setShowNapPrompt] = useState(false);
  const [editingNap, setEditingNap] = useState(false);

  // Weather
  const [city, setCity] = useState("");
  const [showCityInput, setShowCityInput] = useState(false);
  const { weather, loading: weatherLoading } = useWeather(city);

  // Planner
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [loadingPlanner, setLoadingPlanner] = useState(true);
  const [todayPoints, setTodayPoints] = useState(0);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Exercise modal
  const [modalTask, setModalTask] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // Cycle adjustments (female only)
  const [cycleHydrationFactor, setCycleHydrationFactor] = useState(1);
  const [cyclePhase, setCyclePhase] = useState<string | null>(null);

  // Wearable (Fitbit)
  const [wearableConnected, setWearableConnected] = useState(false);
  const [wearableData, setWearableData] = useState<any>(null);
  const [syncWearableLoading, setSyncWearableLoading] = useState(false);
  const [wearableHydrationBoost, setWearableHydrationBoost] = useState(0);

  // Planner optimizer
  const [plannerOptimized, setPlannerOptimized] = useState(false);

  // Catch-up
  const [catchUp, setCatchUp] = useState<{
    amount: number;
    reason: string;
  } | null>(null);

  // Rewards
  const [badges, setBadges] = useState<any[]>([]);
  const [streaks, setStreaks] = useState({
    hydration: 0,
    exercise: 0,
    combined: 0,
  });

  // -------------------- Derived values --------------------
  const baselineGoal = profile?.weight ? profile.weight * 30 : 2000;
  const weatherAdjustEnabled = profile?.weather_adjust_enabled ?? true;
  const weatherAdjusted = weather
    ? computeAdjustedGoal(
        baselineGoal,
        weather.temp,
        weather.humidity,
        weatherAdjustEnabled
      )
    : baselineGoal;
  const dailyGoal =
    Math.round(weatherAdjusted * cycleHydrationFactor) +
    wearableHydrationBoost;

  const totalIntake = entries.reduce((sum, e) => sum + e.amount_ml, 0);
  const remaining = Math.max(dailyGoal - totalIntake, 0);
  const progressPercent = Math.min((totalIntake / dailyGoal) * 100, 100);

  // Hooks for animation style and tone
  const transition = useAnimationStyle(profile?.animation_style);
  const { getMessage } = useTone(profile?.tone_preference, cyclePhase);

  // Drinking rate & prediction
  const drinkingRate = (() => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const recent = entries.filter(
      (e) => new Date(e.logged_at).getTime() > twoHoursAgo
    );
    if (recent.length === 0) return 0;
    const totalRecent = recent.reduce((sum, e) => sum + e.amount_ml, 0);
    return totalRecent / 2; // ml/h
  })();

  const finishTime =
    drinkingRate > 0
      ? new Date(Date.now() + (remaining / drinkingRate) * 3600000)
      : null;

  // -------------------- Data fetching --------------------
  const fetchProfile = async () => {
    const res = await fetch("/api/profile");
    if (res.ok) {
      const { profile } = await res.json();
      setProfile(profile);
      setWakeTime(profile?.wake_time ?? null);
      setSleepTime(profile?.sleep_time ?? null);
      setNapMinutes(profile?.nap_minutes ?? 0);
      if (profile?.weight) setWeightInput(String(profile.weight));
      setPlannerOptimized(
        profile?.planner_preferences &&
          Object.keys(profile.planner_preferences).length > 0 &&
          profile.planner_preferences.lastOptimized
      );
    }
  };

  const fetchWaterEntries = async () => {
    const res = await fetch("/api/water");
    if (res.ok) {
      const { entries } = await res.json();
      setEntries(entries || []);
    }
  };

  const fetchPlanner = async () => {
    setLoadingPlanner(true);
    const res = await fetch("/api/planner");
    if (res.ok) {
      const { tasks } = await res.json();
      tasks.sort(
        (a: any, b: any) =>
          new Date(a.scheduled_time).getTime() -
          new Date(b.scheduled_time).getTime()
      );
      setAllTasks(tasks);
      const pts = tasks.reduce(
        (sum: number, t: any) => sum + (t.points_earned || 0),
        0
      );
      setTodayPoints(pts);
    }
    setLoadingPlanner(false);
  };

  const fetchRewards = async () => {
    const res = await fetch("/api/rewards");
    if (res.ok) {
      const data = await res.json();
      setBadges(data.badges || []);
      setStreaks({
        hydration: data.streaks?.hydration_streak || 0,
        exercise: data.streaks?.exercise_streak || 0,
        combined: data.streaks?.combined_streak || 0,
      });
    }
  };

  const fetchAll = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/auth");
      return;
    }
    setUser(data.user);
    await Promise.all([
      fetchProfile(),
      fetchWaterEntries(),
      fetchPlanner(),
      fetchRewards(),
    ]);
  }, [supabase, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Infer sleep
  useEffect(() => {
    if (profile && !profile.sleep_time) {
      fetch("/api/infer-sleep", { method: "POST" }).catch(() => {});
    }
  }, [profile]);

  // Save goal
  useEffect(() => {
    if (profile && dailyGoal !== profile.daily_goal_ml) {
      const timer = setTimeout(() => {
        fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daily_goal_ml: dailyGoal }),
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [dailyGoal, profile]);

  // Fetch cycle adjustments when gender is female
  useEffect(() => {
    if (profile?.gender !== "female") return;
    const fetchCycle = async () => {
      const res = await fetch("/api/cycle");
      if (res.ok) {
        const data = await res.json();
        if (data.adjustments?.hydrationIncrease) {
          setCycleHydrationFactor(data.adjustments.hydrationIncrease);
        } else {
          setCycleHydrationFactor(1);
        }
        if (data.prediction?.phase) {
          setCyclePhase(data.prediction.phase);
        }
      }
    };
    fetchCycle();
  }, [profile]);

  // Check wearable connection status
  useEffect(() => {
    const checkWearable = async () => {
      if (!user) return;
      const res = await fetch("/api/wearable/status");
      if (res.ok) {
        const { connected } = await res.json();
        setWearableConnected(connected);
      }
    };
    checkWearable();
  }, [user]);

  // Catch-up logic
  useEffect(() => {
    if (!profile || !wakeTime || !sleepTime) return;
    const now = new Date();
    const wakeDec = wakeTime;
    const sleepDec = sleepTime;
    const nowDec =
      now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    let elapsed = nowDec - wakeDec;
    if (elapsed < 0) elapsed += 24;
    const totalWake = sleepDec - wakeDec + (sleepDec < wakeDec ? 24 : 0);
    const idealFraction = Math.min(elapsed / totalWake, 1);
    const idealIntake = dailyGoal * idealFraction;
    const threshold = idealIntake * 0.8;

    if (
      totalIntake < threshold &&
      remaining > 0 &&
      totalWake > 0 &&
      elapsed > 1
    ) {
      const deficit = idealIntake - totalIntake;
      const hoursRemaining = Math.max(sleepDec - nowDec, 0.5);
      const catchAmount = Math.min(Math.round(deficit / hoursRemaining), 400);
      if (catchAmount > 0) {
        setCatchUp({
          amount: catchAmount,
          reason: `You're a bit behind. A quick ${catchAmount} ml will get you back on track.`,
        });
      }
    } else {
      setCatchUp(null);
    }
  }, [entries, dailyGoal, totalIntake, profile, wakeTime, sleepTime]);

  // Auto-adjust hydration tasks when ahead
  useEffect(() => {
    if (
      profile &&
      wakeTime &&
      sleepTime &&
      allTasks.length > 0 &&
      totalIntake > 0
    ) {
      const now = new Date();
      const nowDec = now.getHours() + now.getMinutes() / 60;
      const sleepDec = sleepTime;
      const hoursRemaining = Math.max(sleepDec - nowDec, 0.1);
      const upcomingHydration = allTasks.filter(
        (t) =>
          t.task_type === "hydration" &&
          !t.completed &&
          new Date(t.scheduled_time) > now
      );
      if (
        upcomingHydration.length > 0 &&
        dailyGoal - totalIntake < upcomingHydration.length * 150
      ) {
        fetch("/api/planner/adjust-hydration", { method: "POST" }).then(() =>
          fetchPlanner()
        );
      }
    }
  }, [allTasks, totalIntake, dailyGoal, profile, wakeTime, sleepTime]);

  // -------------------- Actions --------------------
  const handleWeightSave = async () => {
    const weightNum = parseFloat(weightInput);
    if (isNaN(weightNum) || weightNum <= 0) return;
    setLoadingWeight(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: weightNum }),
    });
    if (res.ok) {
      const { profile } = await res.json();
      setProfile(profile);
    }
    setLoadingWeight(false);
  };

  const logWater = async (amount: number) => {
    const tempEntry: WaterEntry = {
      id: `temp-${Date.now()}`,
      amount_ml: amount,
      logged_at: new Date().toISOString(),
    };
    setEntries((prev) => [tempEntry, ...prev]);

    try {
      const res = await fetch("/api/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_ml: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== tempEntry.id));
      } else {
        setEntries((prev) =>
          prev.map((e) => (e.id === tempEntry.id ? data.entry : e))
        );
        if (data.nap_suggestion) {
          setShowNapPrompt(true);
        }
        fetchProfile(); // may update wake_time
      }
    } catch {
      setEntries((prev) => prev.filter((e) => e.id !== tempEntry.id));
    }
  };

  const completeTask = async (taskId: string) => {
    const res = await fetch(`/api/planner/${taskId}`, { method: "PATCH" });
    if (res.ok) {
      await Promise.all([
        fetchPlanner(),
        fetchWaterEntries(),
        fetchRewards(),
      ]);
    }
  };

  const handleSuggestExercises = async () => {
    setSuggestLoading(true);
    const res = await fetch("/api/suggest-exercises", { method: "POST" });
    if (res.ok) {
      fetchPlanner();
    } else {
      alert("Failed to generate suggestions.");
    }
    setSuggestLoading(false);
  };

  const syncWearable = async () => {
    setSyncWearableLoading(true);
    const res = await fetch("/api/wearable/sync", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setWearableData(data);
      let boost = 0;
      if (data.steps > 8000) boost += 250;
      if (data.sleepMinutes < 360) boost += Math.round(baselineGoal * 0.05);
      setWearableHydrationBoost(boost);
    } else {
      alert("Sync failed. Ensure Fitbit is connected.");
    }
    setSyncWearableLoading(false);
  };

  const handleOptimize = async () => {
    const res = await fetch("/api/planner/optimize", { method: "POST" });
    if (res.ok) {
      fetchProfile(); // refresh to update badge
    }
  };

  const handleCatchUpLog = async (amount: number) => {
    await logWater(amount);
    setCatchUp(null);
    fetchPlanner();
    fetchRewards();
  };

  // -------------------- Drag and drop --------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = allTasks.findIndex((t) => t.id === active.id);
    const newIndex = allTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(allTasks, oldIndex, newIndex);
    setAllTasks(newOrder);

    const taskIds = newOrder.filter((t) => !t.completed).map((t) => t.id);
    const res = await fetch("/api/planner/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds }),
    });
    if (!res.ok) {
      fetchPlanner();
    } else {
      fetchPlanner();
    }
  };

  // -------------------- Render --------------------
  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                gender={profile?.gender_based_ui ? profile?.gender : null}
                size={44}
              />
              <div>
                <p className="text-sm text-gray-600">Welcome back,</p>
                <p className="font-semibold text-gray-800">
                  {user?.email?.split("@")[0] || "User"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {todayPoints > 0 && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  {todayPoints} pts
                </span>
              )}
              <span className="text-xs text-gray-500">
                🔥 {streaks.combined} day streak
              </span>
            </div>
          </div>

          {/* Motivational message */}
          <p className="text-center text-sm text-emerald-700 mb-4 font-medium">
            {getMessage("hydration")}
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="rounded-2xl bg-white p-6 shadow-lg"
          >
            {/* Weight input */}
            <div className="mb-6 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Weight (kg):
              </label>
              <input
                type="number"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="70"
                min="1"
              />
              <button
                onClick={handleWeightSave}
                disabled={loadingWeight}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loadingWeight ? "Saving…" : "Save"}
              </button>
            </div>

            {/* Wake / Sleep / Nap times */}
            <div className="mb-6 grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-gray-500">Wake</p>
                {editWake ? (
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={wakeTime ?? ""}
                    onChange={(e) =>
                      setWakeTime(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    onBlur={async () => {
                      setEditWake(false);
                      await fetch("/api/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ wake_time: wakeTime }),
                      });
                    }}
                    className="w-16 text-center border rounded"
                    autoFocus
                  />
                ) : (
                  <p
                    className="font-semibold cursor-pointer"
                    onClick={() => setEditWake(true)}
                  >
                    {wakeTime !== null ? `${wakeTime}:00` : "—"} ✎
                  </p>
                )}
              </div>

              <div className="text-center">
                <p className="text-gray-500">Sleep</p>
                {editSleep ? (
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={sleepTime ?? ""}
                    onChange={(e) =>
                      setSleepTime(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    onBlur={async () => {
                      setEditSleep(false);
                      await fetch("/api/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sleep_time: sleepTime }),
                      });
                    }}
                    className="w-16 text-center border rounded"
                    autoFocus
                  />
                ) : (
                  <p
                    className="font-semibold cursor-pointer"
                    onClick={() => setEditSleep(true)}
                  >
                    {sleepTime !== null ? `${sleepTime}:00` : "—"} ✎
                  </p>
                )}
              </div>

              <div className="text-center">
                <p className="text-gray-500">Nap</p>
                {editingNap ? (
                  <input
                    type="number"
                    min={0}
                    value={napMinutes}
                    onChange={(e) =>
                      setNapMinutes(parseInt(e.target.value) || 0)
                    }
                    onBlur={async () => {
                      setEditingNap(false);
                      await fetch("/api/profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nap_minutes: napMinutes }),
                      });
                    }}
                    className="w-16 text-center border rounded"
                    autoFocus
                  />
                ) : (
                  <p
                    className="font-semibold cursor-pointer"
                    onClick={() => setEditingNap(true)}
                  >
                    {napMinutes > 0 ? `${napMinutes} min` : "—"} ✎
                  </p>
                )}
              </div>
            </div>
            {wakeTime !== null && sleepTime !== null && (
              <p className="text-xs text-center text-gray-400 mb-4">
                ~{((sleepTime - wakeTime + 24) % 24) - napMinutes / 60} wake
                hours
              </p>
            )}

            {/* Weather */}
            {weatherLoading && (
              <Skeleton className="h-12 w-full mb-4" />
            )}
            {weather && (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-sky-50 p-3">
                <div className="flex items-center gap-2">
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
                    alt={weather.condition}
                    className="w-10 h-10"
                  />
                  <div>
                    <p className="font-medium">{weather.temp}°C</p>
                    <p className="text-xs text-gray-500">
                      {weather.condition}, {weather.humidity}% humidity
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCityInput(!showCityInput)}
                  className="text-xs text-blue-600 underline"
                >
                  {city ? city : "Change city"}
                </button>
              </div>
            )}
            {!weather && !weatherLoading && !city && (
              <div className="mb-4 text-sm text-gray-500">
                <p>
                  Allow location access or{" "}
                  <button
                    onClick={() => setShowCityInput(true)}
                    className="underline text-blue-600"
                  >
                    enter a city
                  </button>{" "}
                  for weather‑adjusted goals.
                </p>
              </div>
            )}
            {showCityInput && (
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Enter city"
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  onClick={() => setShowCityInput(false)}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                >
                  Set
                </button>
              </div>
            )}

            {/* Wearable */}
            <div className="mb-4 rounded-lg bg-indigo-50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⌚</span>
                  <div>
                    <p className="text-sm font-medium">Fitbit</p>
                    {wearableConnected ? (
                      <p className="text-xs text-green-600">Connected</p>
                    ) : (
                      <p className="text-xs text-gray-500">Not connected</p>
                    )}
                  </div>
                </div>
                {wearableConnected ? (
                  <button
                    onClick={syncWearable}
                    disabled={syncWearableLoading}
                    className="text-xs bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    {syncWearableLoading ? "Syncing…" : "Sync Now"}
                  </button>
                ) : (
                  <a
                    href="/api/auth/fitbit"
                    className="text-xs bg-indigo-600 text-white px-3 py-1 rounded"
                  >
                    Connect
                  </a>
                )}
              </div>
              {wearableData && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div>🚶 {wearableData.steps} steps</div>
                  <div>
                    💤 {Math.round(wearableData.sleepMinutes / 60)}h sleep
                  </div>
                  <div>❤️ {wearableData.restingHeartRate || "-"} bpm</div>
                </div>
              )}
              {wearableHydrationBoost > 0 && (
                <p className="mt-1 text-xs text-indigo-600">
                  +{wearableHydrationBoost} ml added to goal based on
                  activity/sleep.
                </p>
              )}
            </div>

            {/* Cycle Tracker (female only) */}
            {profile?.gender === "female" && <CycleTracker />}

            {/* Badges */}
            {badges.length > 0 && <BadgeGallery badges={badges} />}

            {/* Goal display */}
            <div className="mb-6 text-center">
              <p className="text-sm text-gray-500">Daily Goal</p>
              <p className="text-2xl font-bold text-emerald-600">
                {dailyGoal} ml
              </p>
              {weather && weatherAdjustEnabled && (
                <p className="text-xs text-gray-400">
                  (baseline {baselineGoal} ml, adjusted for weather)
                </p>
              )}
              {wearableHydrationBoost > 0 && (
                <p className="text-xs text-indigo-500">
                  +{wearableHydrationBoost} ml from Fitbit
                </p>
              )}
            </div>

            {/* Progress circle */}
            <div className="flex justify-center mb-6">
              <ProgressCircle percent={progressPercent} size={160} />
            </div>

            {/* Prediction */}
            {finishTime && (
              <p className="text-center text-sm text-gray-500 mb-4">
                At your current pace, you'll finish by{" "}
                <span className="font-medium">
                  {finishTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
            )}

            {/* Intake stats */}
            <div className="mb-4 flex justify-between text-sm">
              <span>
                <span className="font-semibold">{totalIntake} ml</span> logged
              </span>
              <span>
                <span className="font-semibold">{remaining} ml</span> remaining
              </span>
            </div>

            {/* Water logging buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => logWater(250)}
                className="flex-1 rounded-lg bg-blue-100 py-3 text-sm font-medium text-blue-700 hover:bg-blue-200 transition-colors"
              >
                +250 ml
              </button>
              <button
                onClick={() => logWater(500)}
                className="flex-1 rounded-lg bg-blue-100 py-3 text-sm font-medium text-blue-700 hover:bg-blue-200 transition-colors"
              >
                +500 ml
              </button>
            </div>

            {/* Custom amount */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem(
                  "customAmount"
                ) as HTMLInputElement;
                const amount = parseInt(input.value);
                if (amount > 0) {
                  logWater(amount);
                  input.value = "";
                }
              }}
              className="flex gap-2 mb-6"
            >
              <input
                name="customAmount"
                type="number"
                placeholder="Custom ml"
                min="1"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
              >
                Log
              </button>
            </form>

            {/* Today's Plan */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-700 inline-flex items-center gap-2">
                  Today's Plan
                  {plannerOptimized && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      ✨ Optimized
                    </span>
                  )}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleOptimize}
                    className="text-xs text-purple-600 underline"
                  >
                    Optimize
                  </button>
                  <button
                    onClick={handleSuggestExercises}
                    disabled={suggestLoading}
                    className="text-xs text-emerald-600 underline disabled:opacity-50"
                  >
                    {suggestLoading ? "Suggesting…" : "Suggest Exercises"}
                  </button>
                </div>
              </div>

              {loadingPlanner ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : allTasks.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No tasks yet. Set your wake/sleep times or click "Suggest
                  Exercises".
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={allTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {allTasks.map((task) => (
                        <SortableTask
                          key={task.id}
                          task={task}
                          onComplete={completeTask}
                          onOpenModal={(t) => {
                            setModalTask(t);
                            setShowModal(true);
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Recent water entries */}
            {entries.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  Today's Water Log
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {entries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={transition}
                      className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <span>{entry.amount_ml} ml</span>
                      <span className="text-gray-400">
                        {new Date(entry.logged_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Modals */}
        {showModal && modalTask && (
          <ExerciseModal
            open={showModal}
            onClose={() => {
              setShowModal(false);
              setModalTask(null);
            }}
            task={modalTask}
            onComplete={completeTask}
          />
        )}

        {showNapPrompt && (
          <NapPrompt
            onConfirm={async (minutes) => {
              setNapMinutes((prev) => prev + minutes);
              await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nap_minutes: napMinutes + minutes }),
              });
              setShowNapPrompt(false);
            }}
            onDismiss={() => setShowNapPrompt(false)}
          />
        )}

        {catchUp && (
          <CatchUpPrompt
            amount={catchUp.amount}
            reason={catchUp.reason}
            onLog={handleCatchUpLog}
            onDismiss={() => setCatchUp(null)}
          />
        )}
      </main>
    </ErrorBoundary>
  );
}