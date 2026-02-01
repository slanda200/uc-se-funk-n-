import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import confetti from "./confetti";

export default function AnalysisExercise({
  exercise,
  onComplete,
  onStreak,
  onAnswerResult, // fallback
  onAttemptItem,  // ✅ pro review
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState({}); // { idx: "blue" | "red" }
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const questions = Array.isArray(exercise?.questions) ? exercise.questions : [];
  const current = questions[currentIndex];

  // ✅ LEGEND Z JSONU (bez natvrdo významu barev)
  // Podporuje:
  // 1) new:  exercise.legend / current.legend  -> { red:"...", blue:"..." }
  // 2) old:  exercise.colorLegend / current.colorLegend -> { redLabel:"...", blueLabel:"..." }
  const legend = useMemo(() => {
    const l = current?.legend || exercise?.legend;
    if (l && (l.red || l.blue)) {
      return {
        redLabel: l.red || "Červená",
        blueLabel: l.blue || "Modrá",
      };
    }

    const cl = current?.colorLegend || exercise?.colorLegend || {};
    return {
      redLabel: cl.redLabel || "Červená",
      blueLabel: cl.blueLabel || "Modrá",
    };
  }, [exercise, current]);

  const OPTIONS = useMemo(
    () => [
      { key: "red", label: legend.redLabel, dot: "🔴" },
      { key: "blue", label: legend.blueLabel, dot: "🔵" },
    ],
    [legend]
  );

  const reportStreak = (correct) => {
    if (onStreak) return onStreak(correct);
    onAnswerResult?.(correct);
  };

  const nextColor = (currentColor) => {
    // click cycle: none -> blue -> red -> none
    if (!currentColor) return "blue";
    if (currentColor === "blue") return "red";
    return null;
  };

  const getColorClass = (color) => {
    if (color === "blue") return "bg-blue-200 border-blue-300";
    if (color === "red") return "bg-red-200 border-red-300";
    return "bg-white border-slate-300 hover:bg-slate-100";
  };

  const colorToLabel = (color) => {
    if (color === "blue") return legend.blueLabel;
    if (color === "red") return legend.redLabel;
    return "Neoznačeno";
  };

  const handleTokenClick = (idx) => {
    if (showResult) return;
    setSelected((prev) => {
      const cur = prev[idx] || null;
      const nxt = nextColor(cur);
      const copy = { ...prev };
      if (!nxt) delete copy[idx];
      else copy[idx] = nxt;
      return copy;
    });
  };

  // ✅ tokeny: podporuje:
  // - current.tokens = [{ char:"M", expected:"blue" }, ...]
  // - current.words  = [{ word:"A", color:"red" }, ...] (tvůj běžný formát)
  // - fallback: z textu
  const tokens = useMemo(() => {
    if (!current) return [];

    if (Array.isArray(current.tokens)) {
      return current.tokens.map((t) => ({
        char: t.char ?? t.word ?? "",
        expected: t.expected ?? t.color ?? null, // "blue" | "red"
      }));
    }

    if (Array.isArray(current.words)) {
      return current.words.map((w) => ({
        char: w.char ?? w.word ?? "",
        expected: w.expected ?? w.color ?? null, // "blue" | "red"
      }));
    }

    const raw = current.text || current.question || "";
    const letters = raw.replace(/\s+/g, "").split("");
    return letters.map((c) => ({
      char: c,
      expected: null,
    }));
  }, [current]);

  // ✅ Ready: musí být vybráno pro všechny tokeny
  const isReady = tokens.length > 0 && Object.keys(selected).length === tokens.length;

  const allExpectedReady = tokens.every((t) => t.expected === "blue" || t.expected === "red");

  const handleCheck = () => {
    if (!current || tokens.length === 0) return;

    let correctCount = 0;
    const total = tokens.length;

    for (let i = 0; i < total; i++) {
      const expected = tokens[i]?.expected ?? null;
      const picked = selected[i] ?? null;
      if (expected && picked === expected) correctCount++;
    }

    const allCorrect = allExpectedReady && total > 0 && correctCount === total;

    setShowResult(true);
    reportStreak(allCorrect);

    if (allCorrect) {
      confetti();
      setScore((s) => s + 1);
    }

    // ✅ AttemptReview – co nejjednodušší data
    onAttemptItem?.({
      index: currentIndex,
      type: "analysis",

      prompt: current.question || current.text || "",
      correct: allCorrect,

      // userAnswer: jen char + picked
      userAnswer: tokens.map((t, i) => ({
        char: t.char,
        picked: selected[i] ?? null,
      })),

      // correctAnswer: jen char + expected
      correctAnswer: tokens.map((t) => ({
        char: t.char,
        expected: t.expected ?? null,
      })),

      // ✅ přidáme legend (aby review mohlo případně ukázat význam barev)
      legend: {
        red: legend.redLabel,
        blue: legend.blueLabel,
      },

      explanation: current.explanation || (allCorrect ? "Správně ✅" : "Špatně ❌"),
    });
  };

  const handleContinue = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected({});
      setShowResult(false);
    } else {
      const total = questions.length || 1;
      const finalScore = Math.round((score / total) * 100);
      const stars = finalScore >= 80 ? 3 : finalScore >= 60 ? 2 : 1;
      onComplete?.({ score: finalScore, stars });
    }
  };

  const handleFix = () => {
    setShowResult(false);
  };

  if (!current) return <div className="text-center p-8">Žádné otázky k dispozici</div>;

  const isAllCorrectNow =
    showResult &&
    allExpectedReady &&
    tokens.every((t, i) => (selected[i] ?? null) === (t.expected ?? null));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>Úkol {currentIndex + 1} z {questions.length}</span>
          <span>Skóre: {score}/{questions.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800 mb-3">
          {current.question || current.text}
        </h3>

        {/* ✅ legenda z JSONu */}
        <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm text-slate-700">
          Klikni na každé pole a obarvi ho:
          <span className="ml-2 font-semibold">{OPTIONS[1].dot} {OPTIONS[1].label}</span>,{" "}
          <span className="font-semibold">{OPTIONS[0].dot} {OPTIONS[0].label}</span>
        </div>

        {/* tokeny */}
        <div className="bg-slate-50 rounded-xl p-6 mb-5 flex flex-wrap gap-3 justify-center">
          {tokens.map((t, i) => {
            const picked = selected[i] ?? null;
            const expected = t.expected ?? null;

            const ok = showResult && expected && picked === expected;
            const bad = showResult && expected && picked && picked !== expected;

            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handleTokenClick(i)}
                  className={`w-14 h-14 rounded-xl border-2 text-xl font-bold transition-all ${getColorClass(picked)} ${
                    ok ? "ring-4 ring-emerald-400" : ""
                  } ${bad ? "ring-4 ring-red-400" : ""}`}
                  disabled={showResult}
                  title={colorToLabel(picked)}
                >
                  {t.char}
                </button>

                {showResult && (
                  <div className="text-[11px] leading-tight text-slate-600 text-center max-w-[110px]">
                    <div>
                      Ty:{" "}
                      <span className="font-semibold">
                        {colorToLabel(picked)}
                      </span>
                    </div>
                    <div>
                      Správně:{" "}
                      <span className="font-semibold">
                        {expected ? colorToLabel(expected) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!allExpectedReady && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            Pozor: u této otázky chybí očekávaná barva (expected/color). Bez toho se to nedá vyhodnotit.
            Použij <b>words: [{`{ word:"A", color:"red" }`}]</b> nebo <b>tokens: [{`{ char:"A", expected:"red" }`}]</b>.
          </div>
        )}

        {!showResult ? (
          <Button onClick={handleCheck} disabled={!isReady} className="w-full h-12 text-lg">
            Zkontrolovat
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-slate-50 flex items-start gap-3"
          >
            {isAllCorrectNow ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}

            <div className="flex-1">
              <div className="font-medium text-slate-800">
                {isAllCorrectNow ? "Správně!" : "Špatně."}
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {current.explanation || "—"}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleFix} className="border-2">
                <RotateCcw className="w-4 h-4 mr-2" />
                Opravit
              </Button>
              <Button onClick={handleContinue}>
                Pokračovat
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
