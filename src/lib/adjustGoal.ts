// src/lib/adjustGoal.ts
export function computeAdjustedGoal(
  baseline: number,
  temp: number,
  humidity: number,
  enabled: boolean
): number {
  if (!enabled) return baseline;
  let adjusted = baseline;
  // For each 5°C above 20°C, increase 5%
  if (temp > 20) {
    const extra = Math.floor((temp - 20) / 5) * 0.05;
    adjusted += baseline * extra;
  }
  // If humidity > 70%, add 200ml
  if (humidity > 70) {
    adjusted += 200;
  }
  return Math.round(adjusted);
}