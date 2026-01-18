// fix_exercise.js
const fs = require("fs");

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  return v;
}

function toNumberOrNull(v) {
  if (v === "" || v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ensureArray(v) {
  return Array.isArray(v) ? v : (v == null ? [] : [v]);
}

function normalizeQuestion(q) {
  if (!q || typeof q !== "object") return q;

  // dopln defaulty, aby se ti UI nerozbilo na missing keys
  if (!("options" in q)) q.options = [];
  if (!("pairs" in q)) q.pairs = [];
  if (!("categories" in q)) q.categories = [];
  if (!("words" in q)) q.words = [];

  q.options = ensureArray(q.options);
  q.pairs = ensureArray(q.pairs);
  q.categories = ensureArray(q.categories);
  q.words = ensureArray(q.words);

  // sjednotit null vs undefined (volitelné)
  if (!("audio_url" in q)) q.audio_url = null;
  if (!("image_url" in q)) q.image_url = null;
  if (!("type" in q)) q.type = null;
  if (!("question" in q)) q.question = null;
  if (!("text" in q)) q.text = null;
  if (!("answer" in q)) q.answer = null;

  return q;
}

function normalizeExercise(ex) {
  const out = { ...ex };

  // category_id: "" -> null
  if (out.category_id === "") out.category_id = null;

  // points: "" -> null, string -> number, number ok
  out.points = toNumberOrNull(out.points);

  // is_sample: "false"/"true" -> boolean
  out.is_sample = toBool(out.is_sample);

  // questions: string JSON -> array
  if (typeof out.questions === "string") {
    const s = out.questions.trim();
    if (s) {
      try {
        out.questions = JSON.parse(s);
      } catch (e) {
        // fallback: když je to rozbitý string, necháme to pro debug
        out.questions = [];
        out.questions_parse_error = String(e.message || e);
      }
    } else {
      out.questions = [];
    }
  }

  // questions musí být pole
  if (!Array.isArray(out.questions)) out.questions = [];

  out.questions = out.questions.map(normalizeQuestion);

  return out;
}

// ---- run ----
const inputPath = "exercise.json";
const outputPath = "exercise.fixed.json";

const raw = fs.readFileSync(inputPath, "utf8");
const data = JSON.parse(raw);

if (!Array.isArray(data)) {
  throw new Error("exercise.json musí být pole objektů (Array).");
}

const fixed = data.map(normalizeExercise);

fs.writeFileSync(outputPath, JSON.stringify(fixed, null, 2), "utf8");
console.log(`Hotovo ✅ Vytvořeno: ${outputPath}`);
