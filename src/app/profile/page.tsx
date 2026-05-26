// src/app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const router = useRouter();
  // Supabase client not required at module render; profile endpoints use server APIs

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Form state
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [occupation, setOccupation] = useState("");
  const [gymMode, setGymMode] = useState(false);
  const [animationStyle, setAnimationStyle] = useState("calm");
  const [tonePreference, setTonePreference] = useState("gentle");
  const [genderBasedUi, setGenderBasedUi] = useState(true);
  const [weatherAdjustEnabled, setWeatherAdjustEnabled] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const res = await fetch("/api/profile");
    if (res.ok) {
      const data = await res.json();
      const p = data.profile;
      setProfile(p);
      setWeight(p.weight || "");
      setGender(p.gender || "");
      setAgeRange(p.age_range || "");
      setOccupation(p.occupation_type || "");
      setGymMode(p.gym_mode || false);
      setAnimationStyle(p.animation_style || "calm");
      setTonePreference(p.tone_preference || "gentle");
      setGenderBasedUi(p.gender_based_ui ?? true);
      setWeatherAdjustEnabled(p.weather_adjust_enabled ?? false);
    } else {
      // Not authenticated
      router.push("/auth");
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      weight: weight ? parseFloat(weight) : null,
      gender: gender || null,
      age_range: ageRange || null,
      occupation_type: occupation || null,
      gym_mode: gymMode,
      animation_style: animationStyle,
      tone_preference: tonePreference,
      gender_based_ui: genderBasedUi,
      weather_adjust_enabled: weatherAdjustEnabled,
    };

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMessage("Profile saved successfully!");
      setTimeout(() => setMessage(""), 3000);
    } else {
      const err = await res.json();
      setMessage(err.error || "Save failed");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Profile Settings</h1>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="70"
              min="1"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          {/* Age range */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Age Range</label>
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Select...</option>
              <option value="18-25">18–25</option>
              <option value="26-35">26–35</option>
              <option value="36-50">36–50</option>
              <option value="50+">50+</option>
            </select>
          </div>

          {/* Occupation */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Occupation Type</label>
            <select
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Select...</option>
              <option value="office_worker">Office Worker</option>
              <option value="active_job">Active Job</option>
              <option value="student">Student</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          {/* Gym mode */}
          <div className="flex items-center gap-2">
            <input
              id="gym_mode"
              type="checkbox"
              checked={gymMode}
              onChange={(e) => setGymMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="gym_mode" className="text-sm font-medium text-gray-700">
              Gym Mode (access to gym exercises)
            </label>
          </div>

          {/* Animation style */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Animation Style</label>
            <select
              value={animationStyle}
              onChange={(e) => setAnimationStyle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="energetic">Energetic</option>
              <option value="calm">Calm</option>
              <option value="vibrant">Vibrant</option>
            </select>
          </div>

          {/* Tone preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tone Preference</label>
            <select
              value={tonePreference}
              onChange={(e) => setTonePreference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="motivational">Motivational</option>
              <option value="gentle">Gentle</option>
              <option value="informative">Informative</option>
            </select>
          </div>

          {/* Gender-based UI */}
          <div className="flex items-center gap-2">
            <input
              id="gender_based_ui"
              type="checkbox"
              checked={genderBasedUi}
              onChange={(e) => setGenderBasedUi(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="gender_based_ui" className="text-sm font-medium text-gray-700">
              Use gender‑adaptive UI (colors, icons)
            </label>
          </div>

          {/* Weather adjustment */}
          <div className="flex items-center gap-2">
            <input
              id="weather_adjust"
              type="checkbox"
              checked={weatherAdjustEnabled}
              onChange={(e) => setWeatherAdjustEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="weather_adjust" className="text-sm font-medium text-gray-700">
              Adjust hydration goal based on weather
            </label>
          </div>

          {/* Message */}
          {message && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
