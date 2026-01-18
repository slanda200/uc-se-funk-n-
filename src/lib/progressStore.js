// src/lib/progressStore.js
const KEY = "edu_progress_v1";

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function getProgressMap() {
  const raw = localStorage.getItem(KEY);
  return raw ? safeParse(raw, {}) : {};
}

export function getProgressFor(exerciseId) {
  const map = getProgressMap();
  return map[exerciseId] || null;
}

/**
 * Save best result per exercise.
 * @param {string} exerciseId
 * @param {{score?: number, stars?: number, completed?: boolean}} payload
 */
export function saveProgress(exerciseId, payload) {
  if (!exerciseId) return;

  const map = getProgressMap();
  const prev = map[exerciseId] || null;

  const next = {
    exerciseId,
    completed: payload?.completed ?? true,
    score: typeof payload?.score === "number" ? payload.score : (prev?.score ?? null),
    stars: typeof payload?.stars === "number" ? payload.stars : (prev?.stars ?? null),
    // “best” logika – aby se ti nezhoršovalo skóre, když to někdo zkusí znovu
    bestScore:
      typeof payload?.score === "number"
        ? Math.max(prev?.bestScore ?? 0, payload.score)
        : (prev?.bestScore ?? null),
    bestStars:
      typeof payload?.stars === "number"
        ? Math.max(prev?.bestStars ?? 0, payload.stars)
        : (prev?.bestStars ?? null),
    lastPlayedAt: new Date().toISOString(),
    attempts: (prev?.attempts ?? 0) + 1,
  };

  map[exerciseId] = next;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function clearAllProgress() {
  localStorage.removeItem(KEY);
}
