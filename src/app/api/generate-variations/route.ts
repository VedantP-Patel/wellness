// src/app/api/generate-variations/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Map of base exercise names (or families) to known variations
const VARIATION_MAP: Record<string, string[]> = {
  'squat': ['Goblet Squat', 'Sumo Squat', 'Bulgarian Split Squat', 'Pistol Squat'],
  'press': ['Incline Press', 'Decline Press', 'Close-Grip Press', 'Arnold Press'],
  'row': ['Reverse Grip Row', 'One-Arm Row', 'Pendlay Row', 'T-Bar Row'],
  'curl': ['Incline Curl', 'Concentration Curl', 'Preacher Curl', 'Hammer Curl'],
  'extension': ['Overhead Extension', 'Single-Arm Extension', 'Lying Extension'],
  'raise': ['Lateral Raise', 'Front Raise', 'Bent-Over Raise', 'Cable Raise'],
  'fly': ['Flat Fly', 'Incline Fly', 'Decline Fly', 'Cable Fly'],
  'lunge': ['Walking Lunge', 'Reverse Lunge', 'Side Lunge', 'Curtsy Lunge'],
  'deadlift': ['Sumo Deadlift', 'Romanian Deadlift', 'Single-Leg Deadlift'],
  'push-up': ['Incline Push-up', 'Decline Push-up', 'Diamond Push-up', 'Wide Push-up'],
  'plank': ['Side Plank', 'Plank with Leg Lift', 'Forearm Plank'],
  'pullup': ['Chin-up', 'Neutral Grip Pull-up', 'Wide Grip Pull-up', 'Mixed Grip Pull-up'],
};

function modifyBenefits(parentBenefits: string[], variationName: string): string[] {
  const newBenefits = [...parentBenefits];
  // Add specific benefit based on variation name
  const nameLower = variationName.toLowerCase();
  if (nameLower.includes('single') || nameLower.includes('one-arm')) {
    newBenefits.push('unilateral strength', 'balance');
  }
  if (nameLower.includes('goblet') || nameLower.includes('sumo')) {
    newBenefits.push('core stability');
  }
  if (nameLower.includes('incline')) {
    newBenefits.push('upper chest emphasis');
  }
  if (nameLower.includes('decline')) {
    newBenefits.push('lower chest emphasis');
  }
  if (nameLower.includes('arnold')) {
    newBenefits.push('rotator cuff engagement');
  }
  if (nameLower.includes('pistol')) {
    newBenefits.push('balance', 'unilateral strength');
  }
  // Remove duplicates
  return [...new Set(newBenefits)];
}

function modifyTargetAudience(parentAudience: string[], variationName: string): string[] {
  const audience = [...parentAudience];
  // Adjust based on variation
  const nameLower = variationName.toLowerCase();
  if (nameLower.includes('beginner') || nameLower.includes('assisted')) {
    audience.push('beginners');
  }
  if (nameLower.includes('advanced') || nameLower.includes('pistol')) {
    audience.push('athletes', 'advanced');
  }
  return [...new Set(audience)];
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Only admin can trigger
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all approved exercises (seeds + api) to generate variations from
  const { data: exercises, error } = await supabase
    .from('exercise_library')
    .select('*')
    .in('source', ['seed', 'api'])
    .eq('approved', true);

  if (error || !exercises) {
    return NextResponse.json({ error: error?.message || 'No exercises found' }, { status: 500 });
  }

  let totalGenerated = 0;

  for (const exercise of exercises) {
    const family = exercise.family?.toLowerCase();
    if (!family || !VARIATION_MAP[family]) continue;

    const variations = VARIATION_MAP[family];

    for (const varName of variations) {
      // Skip if variation is too similar to the original name
      if (varName.toLowerCase() === exercise.name.toLowerCase()) continue;

      // Check for duplicates (by name)
      const { data: existing } = await supabase
        .from('exercise_library')
        .select('id')
        .eq('name', varName)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create variation with inherited + modified attributes
      const newBenefits = modifyBenefits(exercise.benefits || [], varName);
      const newAudience = modifyTargetAudience(exercise.target_audience || [], varName);

      const { error: insertError } = await supabase.from('exercise_library').insert({
        name: varName,
        category: exercise.category,
        muscle_group: exercise.muscle_group,
        equipment_needed: exercise.equipment_needed,
        family: family,
        difficulty: Math.min(3, (exercise.difficulty || 1) + 1), // slightly harder
        source: 'generated',
        approved: true,
        benefits: newBenefits,
        target_audience: newAudience,
        impact_level: exercise.impact_level || 7,
      });

      if (!insertError) totalGenerated++;
    }
  }

  return NextResponse.json({
    message: `Generated ${totalGenerated} new variations`,
  });
}