// src/components/BadgeGallery.tsx
"use client";

import { useEffect, useState } from "react";

const BADGE_INFO: Record<string, { name: string; icon: string; desc: string }> = {
  early_bird: { name: "Early Bird", icon: "🌅", desc: "Logged water before 7 AM" },
  gym_hero: { name: "Gym Hero", icon: "🏋️", desc: "Completed 10 exercises" },
  back_pain_hero: { name: "Back Pain Hero", icon: "💪", desc: "Completed back pain relief exercises" },
  office_warrior: { name: "Office Warrior", icon: "🪑", desc: "Regular desk-friendly exercises" },
  perfect_day: { name: "Perfect Day", icon: "🌟", desc: "Completed all tasks in one day" },
  cycle_conscious: { name: "Cycle Conscious", icon: "🩸", desc: "Logged cycle during period" },
  // Add more as needed
};

interface Badge {
  badge_key: string;
  earned_at: string;
}

export default function BadgeGallery({ badges }: { badges: Badge[] }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="rounded-xl bg-yellow-50 p-4 mb-4">
      <h3 className="text-sm font-semibold text-yellow-800 mb-2">Badges</h3>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => {
          const info = BADGE_INFO[badge.badge_key] || { name: badge.badge_key, icon: "🏅", desc: "" };
          return (
            <div
              key={badge.badge_key}
              className="flex items-center gap-1 rounded-full bg-yellow-200 px-3 py-1 text-xs font-medium text-yellow-900"
              title={info.desc}
            >
              <span>{info.icon}</span>
              <span>{info.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}