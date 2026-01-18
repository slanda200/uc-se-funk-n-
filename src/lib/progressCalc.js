// src/lib/progressCalc.js
import { getProgressFor } from "@/lib/progressStore";

// počítá statistiky pro seznam cvičení (např. všechna cvičení tématu)
export function calcStatsForExercises(exercises = []) {
  const items = (exercises || []).filter((e) => !e?.is_test); // testy klidně vynech (můžeš změnit)

  const total = items.length;
  const maxStars = total * 3;

  let completedCount = 0;
  let earnedStars = 0;

  let scoreSum = 0;
  let scoreCount = 0;

  for (const ex of items) {
    const p = getProgressFor(ex.id);
    if (!p) continue;

    if (p.completed) completedCount += 1;

    const stars = (p.bestStars ?? p.stars);
    if (typeof stars === "number") earnedStars += stars;

    const score = (p.bestScore ?? p.score);
    if (typeof score === "number") {
      scoreSum += score;
      scoreCount += 1;
    }
  }

  const avgScore = scoreCount ? Math.round(scoreSum / scoreCount) : 0;

  return {
    total,
    maxStars,
    completedCount,
    earnedStars,
    avgScore,
  };
}
