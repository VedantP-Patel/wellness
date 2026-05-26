// src/app/api/sync-exercises/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BENEFIT_MAP: Record<string, string[]> = {
  chest: ['upper body strength', 'chest activation'],
  back: ['posture improvement', 'back strength'],
  legs: ['leg strength', 'mobility'],
  shoulders: ['shoulder stability', 'upper body mobility'],
  arms: ['arm strength', 'muscle definition'],
  core: ['core stability', 'abdominal strength'],
  full_body: ['full body conditioning', 'coordination'],
  cardio: ['cardiovascular endurance', 'fat loss'],
  flexibility: ['flexibility', 'injury prevention'],
  balance: ['balance', 'core engagement'],
};

function inferBenefits(muscle: string, category: string): string[] {
  const benefits: string[] = [];
  const normMuscle = muscle?.toLowerCase() || '';
  const normCat = category?.toLowerCase() || '';
  if (BENEFIT_MAP[normMuscle]) benefits.push(...BENEFIT_MAP[normMuscle]);
  if (BENEFIT_MAP[normCat]) benefits.push(...BENEFIT_MAP[normCat]);
  return [...new Set(benefits)];
}

function inferTargetAudience(muscle: string, difficulty: number): string[] {
  if (difficulty <= 1) return ['general', 'beginners', 'elderly'];
  if (difficulty === 2) return ['general', 'athletes'];
  return ['athletes'];
}

function extractFamily(name: string): string {
  return name.replace(/[0-9]/g, '').split(' ')[0].toLowerCase().trim();
}

async function syncExercises(request: Request): Promise<NextResponse> {
  // Auth check
  const secret = request.headers.get('x-cron-secret');
  const isCron = secret === process.env.CRON_SECRET;
  if (!isCron) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const apiKey = process.env.EXERCISE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'EXERCISE_API_KEY missing' }, { status: 500 });

  try {
    const res = await fetch('https://api.api-ninjas.com/v1/exercises?equipment=body_weight', {
      headers: { 'X-Api-Key': apiKey }
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const exercises = await res.json();

    const supabase = await createClient();
    let addedCount = 0;

    for (const ex of exercises) {
      if (!ex.name || ex.name.length < 3) continue;
      const family = extractFamily(ex.name);
      const { data: existing } = await supabase
        .from('exercise_library')
        .select('id')
        .or(`name.eq."${ex.name}",family.eq."${family}"`)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const difficulty = ex.difficulty === 'beginner' ? 1 : ex.difficulty === 'intermediate' ? 2 : 3;
      const benefits = inferBenefits(ex.muscle, ex.category);
      const target = inferTargetAudience(ex.muscle, difficulty);

      const { error } = await supabase.from('exercise_library').insert({
        name: ex.name,
        category: ex.category,
        muscle_group: ex.muscle,
        equipment_needed: 'none',
        family: family,
        difficulty: difficulty,
        source: 'api',
        external_id: String(ex.id),
        approved: true,
        benefits: benefits.length > 0 ? benefits : ['general fitness'],
        target_audience: target,
        impact_level: difficulty === 3 ? 9 : difficulty === 2 ? 7 : 5,
      });

      if (!error) addedCount++;
    }

    return NextResponse.json({ message: `Added ${addedCount} new exercises` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return syncExercises(request);
}

export async function POST(request: Request) {
  return syncExercises(request);
}