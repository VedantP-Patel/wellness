// src/lib/similarity.ts

export function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

export function isDuplicateName(
  candidate: string,
  existing: { name: string; family: string }[]
): { isDuplicate: boolean; similarExercises: string[] } {
  const candidateLower = candidate.toLowerCase().trim();
  const similar: string[] = [];

  for (const ex of existing) {
    const nameLower = ex.name.toLowerCase().trim();
    // Exact match
    if (nameLower === candidateLower) {
      return { isDuplicate: true, similarExercises: [ex.name] };
    }
    // Same family and high Jaccard similarity (>0.5)
    if (
      ex.family &&
      candidateLower.includes(ex.family.toLowerCase()) &&
      jaccardSimilarity(candidate, ex.name) >= 0.5
    ) {
      similar.push(ex.name);
    }
  }

  return { isDuplicate: similar.length > 0, similarExercises: similar };
}