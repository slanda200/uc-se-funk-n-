import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Home, ArrowRight, Sparkles } from "lucide-react";

// ✅ načtení exercise (kvůli explanation + topic_id + difficulty)
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const attemptKey = (exerciseId) => `attempts:${String(exerciseId)}`;

function loadAttempts(exerciseId) {
  try {
    const raw = localStorage.getItem(attemptKey(exerciseId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getQueryParam(search, name) {
  const params = new URLSearchParams(search);
  return params.get(name);
}

function normalizeItem(item) {
  const index = item?.index ?? item?.i ?? 0;

  const prompt =
    item?.prompt ??
    item?.question ??
    item?.text ??
    item?.title ??
    "";

  const userAnswer =
    item?.userAnswer ??
    item?.answer ??
    item?.selectedAnswer ??
    item?.value ??
    null;

  const correctAnswer =
    item?.correctAnswer ??
    item?.rightAnswer ??
    item?.solution ??
    item?.correctAnswerText ??
    "";

  const correct =
    typeof item?.correct === "boolean"
      ? item.correct
      : typeof item?.isCorrect === "boolean"
      ? item.isCorrect
      : null;

  const explanation =
    item?.explanation ??
    item?.explanationText ??
    item?.note ??
    null;

  // ✅ zachovej typ (kvůli speciálnímu renderu)
  const type = item?.type ?? item?.kind ?? null;

  return { index, prompt, userAnswer, correctAnswer, correct, explanation, type, raw: item };
}

function Tile({ char, picked }) {
  const cls =
    picked === "blue"
      ? "bg-blue-200 border-blue-300"
      : picked === "red"
      ? "bg-red-200 border-red-300"
      : "bg-white border-slate-300";

  const title =
    picked === "blue" ? "Modrá" : picked === "red" ? "Červená" : "Neoznačeno";

  return (
    <div
      className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-bold ${cls}`}
      title={title}
    >
      {char}
    </div>
  );
}

// ----------------------------
// ✅ difficulty helpers (1..3)
// ----------------------------
function getExerciseDifficulty(ex) {
  const d = ex?.difficulty;
  const n = typeof d === "string" ? Number(d) : d;
  return Number.isFinite(n) ? n : null; // 1..3
}
function harderDifficulty(current) {
  if (!Number.isFinite(current)) return null;
  return Math.min(3, Math.max(1, current) + 1);
}
function easierDifficulty(current) {
  if (!Number.isFinite(current)) return null;
  return Math.max(1, Math.min(3, current) - 1);
}

// ----------------------------
// ✅ "jiný typ" preference
// ----------------------------
const TYPE_FALLBACK_ORDER = ['quiz', 'decision', 'fill', 'cloze', 'match', 'sort', 'memory', 'analysis', 'listening', 'image', 'test'];

function pickDifferentTypeExercise(exercises, currentType) {
  if (!Array.isArray(exercises) || exercises.length === 0) return null;
  for (const t of TYPE_FALLBACK_ORDER) {
    if (t === currentType) continue;
    const found = exercises.find((e) => e?.type === t);
    if (found) return found;
  }
  return exercises.find((e) => e?.type && e.type !== currentType) || null;
}

export default function AttemptReview() {
  const location = useLocation();
  const navigate = useNavigate();

  const exerciseId = getQueryParam(location.search, "exercise");
  const attemptId = getQueryParam(location.search, "attempt");

  // ✅ načteme exercise (kvůli explanation z DB + topic_id + difficulty + type)
  const { data: exercise } = useQuery({
    queryKey: ["exercise", exerciseId],
    queryFn: async () => {
      const list = await base44.entities.Exercise.filter({ id: exerciseId });
      return list[0];
    },
    enabled: !!exerciseId,
  });

  const attempts = useMemo(() => {
    if (!exerciseId) return [];
    return loadAttempts(exerciseId);
  }, [exerciseId]);

  const attempt = useMemo(() => {
    if (!attempts.length) return null;

    if (attemptId) {
      const found = attempts.find((a) => String(a.id) === String(attemptId));
      if (found) return found;
    }

    // fallback: poslední attempt
    return attempts[0];
  }, [attempts, attemptId]);

  const title = attempt?.exerciseTitle || "Rozbor";
  const subtitle = attempt?.topicName || "";

  // ✅ kam má vést "Zpět na úlohy"
  const topicId =
    attempt?.topicId ||
    attempt?.topic_id ||
    exercise?.topic_id ||
    null;

  const backToListUrl = topicId
    ? createPageUrl(`Exercises?topic=${topicId}`)
    : createPageUrl("Exercises");

  // ✅ NEW: všechny úlohy ve stejném topicu (kvůli “Další úloha”)
  const { data: topicExercises = [] } = useQuery({
    queryKey: ["topicExercises", topicId],
    queryFn: async () => {
      if (!topicId) return [];
      const list = await base44.entities.Exercise.filter({ topic_id: topicId });
      return Array.isArray(list) ? list : [];
    },
    enabled: !!topicId,
  });

  // ✅ NEW: doporučení další úlohy podle score + difficulty + type
  const recommendation = useMemo(() => {
    if (!attempt || !exercise) return null;

    const score = Number(attempt?.score ?? 0);
    const curType = exercise?.type || null;
    const curDiff = getExerciseDifficulty(exercise);

    const all = Array.isArray(topicExercises) ? topicExercises : [];
    const others = all.filter((e) => String(e?.id) !== String(exercise?.id));
    if (others.length === 0) return null;

    const sameDiff = (d) => others.filter((e) => getExerciseDifficulty(e) === d);

    // ≥ 75 → těžší (preferuj stejný typ)
    if (score >= 75) {
      const harder = harderDifficulty(curDiff);
      const poolHarder = harder ? sameDiff(harder) : [];

      const chosen =
        poolHarder.find((e) => e?.type === curType) ||
        poolHarder[0] ||
        others.find((e) => {
          const d = getExerciseDifficulty(e);
          return d !== null && curDiff !== null && d > curDiff;
        }) ||
        null;

      if (!chosen) return null;

      return {
        title: "Ty brďo, ty válíš! 🔥",
        text: "Chceš se posunout na těžší cvičení ve stejném tématu?",
        button: "Jdu na těžší",
        exercise: chosen,
      };
    }

    // 20–74 → jiný typ (stejná obtížnost)
    if (score >= 20) {
      const pool = curDiff ? sameDiff(curDiff) : others;
      const chosen = pickDifferentTypeExercise(pool, curType) || pickDifferentTypeExercise(others, curType);
      if (!chosen) return null;

      return {
        title: "Ještě trochu procvičit? 💪",
        text: "Zkus stejné téma, ale jiným typem úlohy – často to pomůže.",
        button: "Zkusit jiný typ",
        exercise: chosen,
      };
    }

    // < 20 → lehčí (nebo fallback: jiný typ)
    const easier = easierDifficulty(curDiff);
    const poolEasier = easier ? sameDiff(easier) : [];
    const chosenEasier = poolEasier[0] || null;

    if (chosenEasier) {
      return {
        title: "Tohle bylo těžší… nevadí 🙂",
        text: "Chceš zkusit lehčí úroveň ve stejném tématu?",
        button: "Zkusit lehčí",
        exercise: chosenEasier,
      };
    }

    const fallback = pickDifferentTypeExercise(curDiff ? sameDiff(curDiff) : others, curType) || pickDifferentTypeExercise(others, curType);
    if (!fallback) return null;

    return {
      title: "Zkusíme to jinak 🙂",
      text: "Dáme stejné téma, ale jiným typem úlohy.",
      button: "Jiný typ úlohy",
      exercise: fallback,
    };
  }, [attempt, exercise, topicExercises]);

  const goToRecommended = () => {
    const nextId = recommendation?.exercise?.id;
    if (!nextId) return;
    navigate(createPageUrl(`Play?exercise=${nextId}`));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          {/* vlevo = znovu spustit stejné cvičení */}
          <Link to={createPageUrl(`Play?exercise=${exerciseId}`)}>
            <Button variant="ghost">
              <RotateCcw className="w-4 h-4 mr-2" />
              Zkusit toto cvičení znovu
            </Button>
          </Link>

          <div className="text-center">
            <div className="text-xl font-bold text-slate-800">{title}</div>
            <div className="text-sm text-slate-500">
              {subtitle ? subtitle : "Rozbor"}
              {attempt ? "" : " (zatím bez uložených odpovědí)"}
            </div>
          </div>

          <div className="w-40" />
        </div>

        {/* ✅ NEW: box s doporučením + tlačítko Další úloha */}
        {attempt && recommendation?.exercise?.id && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-slate-700" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800">{recommendation.title}</div>
                <div className="text-sm text-slate-600 mt-1">{recommendation.text}</div>
                <div className="text-xs text-slate-500 mt-2">
                  Návrh: <span className="font-semibold">{recommendation.exercise.title}</span>
                </div>
              </div>
            </div>

            <Button onClick={goToRecommended} className="w-full mt-3 h-12 rounded-2xl">
              {recommendation.button}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {!attempt && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl p-4 mb-6">
            <div className="font-bold mb-1">Ještě tu nejsou uložené odpovědi.</div>
            <div className="text-sm">
              Aby se zobrazilo „jak jsi to vyplnil“, musí být uložený attempt v localStorage.
              Ověř, že po dokončení cvičení se uloží do <b>{attemptKey(exerciseId || "")}</b>.
            </div>
          </div>
        )}

        {attempt && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <div>
                <span className="font-semibold text-slate-700">Skóre:</span>{" "}
                {attempt.score ?? "—"}%
              </div>
              <div>
                <span className="font-semibold text-slate-700">Hvězdy:</span>{" "}
                {attempt.stars ?? "—"}
              </div>
              {typeof attempt.bestCombo === "number" && (
                <div>
                  <span className="font-semibold text-slate-700">Nejlepší série:</span>{" "}
                  {attempt.bestCombo}×
                </div>
              )}
              <div className="ml-auto text-xs text-slate-400">
                {attempt.createdAt ? new Date(attempt.createdAt).toLocaleString() : ""}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {(attempt?.items || []).length === 0 && attempt && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 text-slate-600">
              Tohle cvičení zatím neposlalo žádné položky do review (`onAttemptItem`).
            </div>
          )}

          {attempt?.items?.map?.((raw, idx) => {
            const it = normalizeItem(raw);
            const captured =
              it.userAnswer !== null && it.userAnswer !== undefined && it.userAnswer !== "";
            const correctText = it.correctAnswer ?? "";

            const statusBg =
              it.correct === true
                ? "bg-emerald-50 border-emerald-100"
                : it.correct === false
                ? "bg-red-50 border-red-100"
                : "bg-white border-slate-100";

            const pickExplanation = (q) =>
              q?.explanation ?? q?.explanationText ?? q?.note ?? q?.reason ?? null;

            const byIndex = pickExplanation(exercise?.questions?.[it.index]);

            const byPrompt = it.prompt
              ? pickExplanation(
                  exercise?.questions?.find(
                    (q) =>
                      String(q?.question ?? "").trim() ===
                      String(it.prompt ?? "").trim()
                  )
                )
              : null;

            const attemptExplanation =
              typeof it.explanation === "string" &&
              !["Správně.", "Špatně.", "Správně ✅", "Špatně ❌"].includes(
                it.explanation.trim()
              )
                ? it.explanation
                : null;

            const exerciseExplanation = byIndex || byPrompt || null;

            const finalExplanation =
              exerciseExplanation ||
              attemptExplanation ||
              "Vysvětlivka není u této otázky vyplněná.";

            return (
              <div key={idx} className={`rounded-2xl border p-5 ${statusBg}`}>
                <div className="text-sm text-slate-500 mb-1">Otázka {it.index + 1}</div>

                <div className="text-lg font-bold text-slate-800 mb-3">
                  {it.prompt || "(bez zadání)"}
                </div>

                <div className="text-sm text-slate-700 space-y-2">
                  <div>
                    <span className="font-semibold">Tvoje odpověď:</span>{" "}
                    {!captured ? (
                      <span className="text-slate-400">(nezachyceno)</span>
                    ) : it.type === "analysis" && Array.isArray(it.userAnswer) ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {it.userAnswer.map((a, i) => (
                          <Tile key={i} char={a.char} picked={a.picked ?? null} />
                        ))}
                      </div>
                    ) : (
                      <span
                        className={
                          it.correct === false
                            ? "text-red-700"
                            : it.correct === true
                            ? "text-emerald-700"
                            : ""
                        }
                      >
                        {String(it.userAnswer)}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="font-semibold">Správně:</span>{" "}
                    {it.type === "analysis" && Array.isArray(it.correctAnswer) ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {it.correctAnswer.map((a, i) => (
                          <Tile key={i} char={a.char} picked={a.expected ?? null} />
                        ))}
                      </div>
                    ) : (
                      String(correctText)
                    )}
                  </div>

                  <div className="mt-3 bg-white/60 rounded-xl p-3 border border-slate-100">
                    <div className="text-xs font-semibold text-slate-600 mb-1">
                      Vysvětlení
                    </div>
                    <div className="text-sm text-slate-600">{finalExplanation}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex gap-3">
          <Link to={backToListUrl} className="flex-1">
            <Button className="w-full h-12">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na úlohy
            </Button>
          </Link>

          <Link to={createPageUrl("Home")} className="flex-1">
            <Button variant="outline" className="w-full h-12">
              <Home className="w-4 h-4 mr-2" />
              Domů
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
