import React from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, ArrowRight, RotateCcw } from "lucide-react";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isAnswerCorrect(expected, user) {
  // expected: string | { mode:'subset', items:[...] }
  if (expected && typeof expected === "object" && expected.mode === "subset" && Array.isArray(expected.items)) {
    const u = norm(user);
    return expected.items.some((it) => norm(it) === u);
  }
  return norm(expected) === norm(user);
}

/**
 * TestExercise
 * - pokud exercise.questions je prázdné, namixuje otázky z ostatních úloh
 * - míchání je podle priority: category_id (pokud existuje) → jinak topic_id
 * - drží se exercise.difficulty a bere max exercise.test_question_limit
 */
export default function TestExercise({
  exercise,
  onComplete,
  onAttemptItem,
  onTestStats,
}) {
  const limit = Number(exercise?.test_question_limit ?? 15);

  const [mixed, setMixed] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const [index, setIndex] = React.useState(0);
  const [selected, setSelected] = React.useState(null); // for MCQ
  const [typed, setTyped] = React.useState(""); // for fill
  const [submitted, setSubmitted] = React.useState(false);
  const [isCorrect, setIsCorrect] = React.useState(null);
  const [correctCount, setCorrectCount] = React.useState(0);

  const current = mixed[index] ?? null;
  const total = mixed.length;

  // keep parent header in sync
  React.useEffect(() => {
    if (typeof onTestStats === "function") {
      onTestStats({ correct: correctCount, total, current: Math.min(index + 1, total) });
    }
  }, [correctCount, total, index, onTestStats]);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        // 1) pokud už test obsahuje otázky, použijeme je (ale očekáváme už normalizovaný tvar)
        if (Array.isArray(exercise?.questions) && exercise.questions.length > 0) {
          const direct = exercise.questions
            .map((q, i) => ({
              id: q.id ?? `direct_${i}`,
              srcType: q.type ?? exercise.type,
              prompt: q.text ?? q.question ?? "",
              options: Array.isArray(q.options) ? q.options : [],
              answer: q.answer,
              explanation: q.explanation ?? "",
            }))
            .slice(0, limit);
          if (alive) {
            setMixed(direct);
            setIndex(0);
            setSelected(null);
            setTyped("");
            setSubmitted(false);
            setIsCorrect(null);
            setCorrectCount(0);
          }
          return;
        }

        // 2) jinak namixujeme z poolu
        const topicId = exercise?.topic_id;
        if (!topicId) {
          if (alive) setMixed([]);
          return;
        }

        const all = await base44.entities.Exercise.filter({ topic_id: topicId });

        const sameCategory = (ex2) => {
          const a = exercise?.category_id;
          const b = ex2?.category_id;
          if (a === null || typeof a === "undefined") {
            return b === null || typeof b === "undefined";
          }
          return String(a) === String(b);
        };

        const allowedTypes = new Set(["decision", "quiz", "cloze", "fill"]);

        const pool = (all || [])
          .filter((ex2) => !ex2?.is_test)
          .filter((ex2) => ex2?.type !== "test")
          .filter((ex2) => ex2?.difficulty === exercise?.difficulty)
          .filter((ex2) => sameCategory(ex2))
          .filter((ex2) => allowedTypes.has(ex2?.type))
          .filter((ex2) => Array.isArray(ex2?.questions) && ex2.questions.length > 0);

        const flat = [];
        for (const ex2 of pool) {
          for (let i = 0; i < ex2.questions.length; i++) {
            const q = ex2.questions[i];
            const prompt = q?.text ?? q?.question ?? "";
            const options = Array.isArray(q?.options) ? q.options : [];
            flat.push({
              id: `${ex2.id || ex2.title || "ex"}_${i}`,
              srcType: ex2.type,
              prompt,
              options,
              answer: q?.answer,
              explanation: q?.explanation ?? "",
            });
          }
        }

        const picked = shuffle(flat).slice(0, limit);

        if (alive) {
          setMixed(picked);
          setIndex(0);
          setSelected(null);
          setTyped("");
          setSubmitted(false);
          setIsCorrect(null);
          setCorrectCount(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [exercise?.id]);

  const progressPct = total > 0 ? Math.round((index / total) * 100) : 0;

  const canSubmit = React.useMemo(() => {
    if (!current) return false;
    if (submitted) return false;
    if (current.srcType === "fill") {
      return norm(typed).length > 0;
    }
    // mcq
    return selected !== null;
  }, [current, submitted, selected, typed]);

  const submit = React.useCallback(() => {
    if (!current || submitted) return;

    const userAnswer = current.srcType === "fill" ? typed : selected;
    const ok = isAnswerCorrect(current.answer, userAnswer);

    setSubmitted(true);
    setIsCorrect(ok);
    if (ok) setCorrectCount((c) => c + 1);

    // push to review (pokud chceš)
    if (typeof onAttemptItem === "function") {
      try {
        onAttemptItem({
          question: current.prompt,
          userAnswer,
          correctAnswer: current.answer,
          isCorrect: ok,
          explanation: current.explanation,
          type: current.srcType,
        });
      } catch {
        // noop
      }
    }
  }, [current, submitted, typed, selected, onAttemptItem]);

  const next = React.useCallback(() => {
    if (!submitted) return;

    const isLast = index >= total - 1;
    if (isLast) {
      const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      if (typeof onComplete === "function") {
        onComplete({
          score: scorePct,
          correct: correctCount,
          total,
          passed: total > 0 ? correctCount >= Math.ceil(total * 0.6) : false,
        });
      }
      return;
    }

    setIndex((i) => i + 1);
    setSelected(null);
    setTyped("");
    setSubmitted(false);
    setIsCorrect(null);
  }, [submitted, index, total, correctCount, onComplete]);

  const restart = React.useCallback(() => {
    setIndex(0);
    setSelected(null);
    setTyped("");
    setSubmitted(false);
    setIsCorrect(null);
    setCorrectCount(0);
  }, []);

  if (!exercise) {
    return <div className="text-sm text-gray-600">Načítám…</div>;
  }

  if (loading) {
    return <div className="text-sm text-gray-600">Připravuju test…</div>;
  }

  if (total === 0) {
    return (
      <div className="p-4 rounded-xl border bg-white">
        <div className="font-semibold">V tomhle testu nejsou žádné otázky.</div>
        <div className="text-sm text-gray-600 mt-1">
          Zkontroluj, že v tématu/kategorii existují úlohy se stejnou obtížností a že nejsou označené jako test.
        </div>
      </div>
    );
  }

  const showMCQ = current && current.srcType !== "fill" && Array.isArray(current.options) && current.options.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-sm text-gray-600 whitespace-nowrap">
          Otázka <span className="font-semibold">{index + 1}</span> / {total}
        </div>
        <div className="flex-1">
          <Progress value={progressPct} />
        </div>
      </div>

      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl border bg-white p-5 shadow-sm"
      >
        <div className="text-lg font-semibold leading-snug">{current.prompt}</div>

        <div className="mt-4 space-y-2">
          {showMCQ ? (
            current.options.map((opt) => {
              const active = selected === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => !submitted && setSelected(opt)}
                  disabled={submitted}
                  className={
                    "w-full text-left px-4 py-3 rounded-xl border transition " +
                    (active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50") +
                    (submitted ? " opacity-90 cursor-default" : "")
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{opt}</span>
                    {submitted && opt === current.answer ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                Napiš odpověď:
              </div>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={submitted}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Tvoje odpověď…"
              />
            </div>
          )}
        </div>

        {!submitted ? (
          <Button
            className="w-full h-20 text-lg rounded-2xl mt-5"
            onClick={submit}
            disabled={!canSubmit}
          >
            Odeslat odpověď
          </Button>
        ) : (
          <div className="mt-5 space-y-3">
            <div
              className={
                "flex items-center gap-2 font-semibold " +
                (isCorrect ? "text-green-700" : "text-red-700")
              }
            >
              {isCorrect ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              {isCorrect ? "Správně!" : "Špatně."}
            </div>

            {!isCorrect ? (
              <div className="text-sm text-gray-700">
                Správná odpověď: <span className="font-semibold">{String(current.answer)}</span>
              </div>
            ) : null}

            {current.explanation ? (
              <div className="text-sm text-gray-600">{current.explanation}</div>
            ) : null}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={restart}
                title="Začít znovu"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Znovu
              </Button>

              <Button
                className="flex-1 h-12 rounded-xl"
                onClick={next}
              >
                Pokračovat
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      <div className="text-sm text-gray-600">
        Skóre: <span className="font-semibold">{correctCount}</span> / {total}
      </div>
    </div>
  );
}
