// src/app/api/exercises/submit/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isDuplicateName } from "@/lib/similarity";

// Quick suggestion for benefits based on name/category
function suggestBenefits(name: string, category: string): string[] {
  const suggestions: string[] = [];
  const lowerName = name.toLowerCase();
  if (lowerName.includes('stretch') || category === 'flexibility') suggestions.push('flexibility', 'injury prevention');
  if (lowerName.includes('cardio') || category === 'cardio') suggestions.push('cardiovascular endurance', 'fat loss');
  if (lowerName.includes('strength') || category === 'strength') suggestions.push('muscle strength');
  if (lowerName.includes('core') || lowerName.includes('ab')) suggestions.push('core stability');
  if (lowerName.includes('balance')) suggestions.push('balance', 'coordination');
  return [...new Set(suggestions)];
}

function suggestAudience(name: string, difficulty: number): string[] {
  if (difficulty <= 1) return ['beginners', 'general', 'elderly'];
  if (difficulty === 2) return ['general', 'gym goers'];
  return ['athletes'];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name,
    category,
    muscle_group,
    equipment_needed,
    family,
    difficulty,
    benefits,        // optional array from user
    target_audience, // optional array from user
  } = body;

  if (!name || !category || !muscle_group || !equipment_needed || !family || !difficulty) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['none', 'bodyweight', 'dumbbell', 'barbell', 'machine', 'cable', 'band', 'other'].includes(equipment_needed)) {
    return NextResponse.json({ error: 'Invalid equipment type' }, { status: 400 });
  }
  if (difficulty < 1 || difficulty > 3) {
    return NextResponse.json({ error: 'Difficulty must be 1, 2, or 3' }, { status: 400 });
  }

  // Clean up arrays
  const userBenefits: string[] = Array.isArray(benefits) ? benefits : [];
  const userAudience: string[] = Array.isArray(target_audience) ? target_audience : [];

  // If user didn't provide, auto-suggest
  const finalBenefits = userBenefits.length > 0 ? userBenefits : suggestBenefits(name, category);
  const finalAudience = userAudience.length > 0 ? userAudience : suggestAudience(name, difficulty);

  // Duplicate check – fetch approved exercises (including those already pending but duplicate names)
  const { data: existingExercises, error: fetchError } = await supabase
    .from('exercise_library')
    .select('name, family')
    .or(`approved.eq.true,source.eq.user`) // check both approved and previous user submissions
    .limit(100); // reasonable limit

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const { isDuplicate, similarExercises } = isDuplicateName(name, existingExercises || []);
  if (isDuplicate) {
    return NextResponse.json({
      error: 'Duplicate or too similar to existing exercise.',
      similar: similarExercises,
    }, { status: 409 });
  }

  // Insert with source='user' and approved=false
  const { error: insertError } = await supabase.from('exercise_library').insert({
    name,
    category,
    muscle_group,
    equipment_needed,
    family,
    difficulty,
    source: 'user',
    approved: false,
    benefits: finalBenefits,
    target_audience: finalAudience,
    impact_level: 5, // default, admin can change
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ message: 'Exercise submitted for review.' });
}