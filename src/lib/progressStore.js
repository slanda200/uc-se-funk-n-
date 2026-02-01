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

export function saveProgress(exerciseId, payload) {
  if (!exerciseId) return;

  const map = getProgressMap();
  const prev = map[exerciseId] || {};

  const next = {
    exerciseId,
    completed: payload?.completed ?? true,
    score: payload?.score ?? prev.score ?? null,
    stars: payload?.stars ?? prev.stars ?? null,
    bestScore: Math.max(prev.bestScore ?? 0, payload?.score ?? 0),
    bestStars: Math.max(prev.bestStars ?? 0, payload?.stars ?? 0),
    attempts: (prev.attempts ?? 0) + 1,
    lastPlayedAt: new Date().toISOString(),
  };

  map[exerciseId] = next;
  localStorage.setItem(KEY, JSON.stringify(map));

  window.dispatchEvent(new Event("edu-progress"));
}

export function clearAllProgress() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("edu-progress"));
}
