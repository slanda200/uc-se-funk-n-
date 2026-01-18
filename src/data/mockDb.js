// src/data/mockDb.js
import subjectsRaw from "@/data/base44/subject.json";
import topicsRaw from "@/data/base44/topic.json";
import categoriesRaw from "@/data/base44/category.json";
import exercisesRaw from "@/data/base44/exercise.json";
import userProgressRaw from "@/data/base44/userprogress.json";

// Pomoc: Base44 exporty bývají často stringy. Tady to trochu normalizujeme.
function toNumberMaybe(v) {
  if (v === null || v === undefined || v === "") return v;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

// Bezpečné rozparsování JSON uloženého jako string v CSV exportu
function tryParseJSON(value) {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return value;

  // parsujeme jen když to vypadá jako JSON objekt/pole
  const looksLikeJSON = s.startsWith("{") || s.startsWith("[");
  if (!looksLikeJSON) return value;

  try {
    return JSON.parse(s);
  } catch {
    return value;
  }
}

function normalizeList(list) {
  return (list || []).map((x) => {
    const obj = { ...x };

    // typické číselné klíče
    ["order", "grade", "difficulty", "points"].forEach((k) => {
      if (k in obj) obj[k] = toNumberMaybe(obj[k]);
    });

    // boolean
    if ("is_test" in obj) {
      obj.is_test = obj.is_test === true || obj.is_test === "true";
    }

    // Občas bývá v exportu "null" jako text
    Object.keys(obj).forEach((k) => {
      if (obj[k] === "null") obj[k] = null;
      if (obj[k] === "undefined") obj[k] = undefined;
    });

    return obj;
  });
}

export const subjects = normalizeList(subjectsRaw);
export const topics = normalizeList(topicsRaw);
export const categories = normalizeList(categoriesRaw);

// Exercises mají nejčastěji “vnořená data” uložená jako JSON string
export const exercises = normalizeList(exercisesRaw).map((e) => {
  const ex = { ...e };

  // Base44 export často ukládá strukturu do textového pole (např. content / data / payload / config)
  ["content", "data", "payload", "config"].forEach((k) => {
    if (k in ex) ex[k] = tryParseJSON(ex[k]);
  });

  // Často se i konkrétní pole ukládají jako JSON string
  ["options", "pairs", "items", "words", "answers", "cards", "left", "right"].forEach((k) => {
    if (k in ex) ex[k] = tryParseJSON(ex[k]);
  });

  return ex;
});

export const userProgress = normalizeList(userProgressRaw);
