import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import confetti from '@/components/exercises/confetti';

// Fisher–Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FillExercise({
  exercise,
  onComplete,
  onStreak,
  onAnswerResult, // fallback
  onAttemptItem,
}) {
  const pickCount = Number.isFinite(exercise?.pickCount) ? exercise.pickCount : 20;

  const pickedQuestions = useMemo(() => {
    const all = Array.isArray(exercise?.questions) ? exercise.questions : [];
    if (all.length === 0) return [];
    const shuffled = shuffle(all);
    return shuffled.slice(0, Math.min(pickCount, shuffled.length));
  }, [exercise?.id]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  const questions = pickedQuestions;
  const currentQuestion = questions[currentIndex];

  const normalizeOne = (s) => (s || '').trim().toLowerCase();

  // U subset režimu rozsekáme vstup na položky: čárky / středníky / nové řádky
  const parseList = (raw) => {
    const text = (raw ?? '').trim();
    if (!text) return [];
    return text
      .split(/[,\n;]+/g)
      .map((x) => normalizeOne(x))
      .filter(Boolean);
  };

  const reportStreak = (correct) => {
    // ✅ streak jen 1×
    if (onStreak) return onStreak(correct);
    onAnswerResult?.(correct);
  };

  const formatCorrectAnswerForReview = (ans) => {
    if (Array.isArray(ans)) return ans.join(', ');
    if (ans && typeof ans === 'object') {
      if (ans.mode === 'subset' && Array.isArray(ans.items)) return ans.items.join(', ');
      if (ans.mode === 'set_exact' && Array.isArray(ans.items)) return ans.items.join(', ');
      if (Array.isArray(ans.items)) return ans.items.join(', ');
      return JSON.stringify(ans);
    }
    return String(ans ?? '');
  };

  const logAttempt = ({ rawUser, correct, meta }) => {
    const qText = currentQuestion?.question ?? '';
    const correctAns = currentQuestion?.answer ?? '';
    const explanation =
      currentQuestion?.explanation ||
      (correct ? 'Správně ✅' : 'Špatně ❌');

    onAttemptItem?.({
      index: currentIndex,

      // typy
      type: 'fill',
      kind: 'fill',

      // otázka
      prompt: qText,
      question: qText,
      text: qText,

      // odpověď uživatele
      userAnswer: rawUser,
      answer: rawUser,
      selectedAnswer: rawUser,

      // správná odpověď (textově pro review)
      correctAnswer: formatCorrectAnswerForReview(correctAns),

      // boolean
      correct: correct,
      isCorrect: correct,

      // vysvětlivka
      explanation,
      explanationText: explanation,

      // meta (užitečné pro debug/analytics)
      meta,
    });
  };

  // Vrací { correct: boolean, meta: {mode, ...} }
  const evaluate = (rawUser, expected) => {
    // 1) string — původní chování
    if (typeof expected === 'string' || typeof expected === 'number') {
      const user = normalizeOne(rawUser);
      const corr = normalizeOne(String(expected));
      return { correct: user === corr, meta: { mode: 'string' } };
    }

    // 2) array — povolené odpovědi (uživatel může zadat 1 nebo více, ale všechny musí být z povolených)
    if (Array.isArray(expected)) {
      const allowed = new Set(expected.map((x) => normalizeOne(String(x))));
      const items = parseList(rawUser);

      // Musí zadat aspoň 1 položku a všechny musí být povolené
      if (items.length === 0) return { correct: false, meta: { mode: 'array', reason: 'empty' } };

      const invalid = items.filter((x) => !allowed.has(x));
      const uniqueCount = new Set(items).size;

      return {
        correct: invalid.length === 0,
        meta: {
          mode: 'array',
          provided: items,
          providedUnique: uniqueCount,
          invalid,
          allowedCount: allowed.size,
        },
      };
    }

    // 3) object with mode
    if (expected && typeof expected === 'object') {
      const mode = expected.mode;
      const itemsDef = Array.isArray(expected.items) ? expected.items : [];
      const allowed = new Set(itemsDef.map((x) => normalizeOne(String(x))));
      const items = parseList(rawUser);

      if (mode === 'subset') {
        // ✅ přesně co chceš: 1+ položek, všechny musí být v allowed
        if (items.length === 0) return { correct: false, meta: { mode: 'subset', reason: 'empty' } };
        const invalid = items.filter((x) => !allowed.has(x));
        return {
          correct: invalid.length === 0,
          meta: { mode: 'subset', provided: items, invalid, allowedCount: allowed.size },
        };
      }

      if (mode === 'set_exact') {
        // (kdybys někdy chtěl) musí sedět přesně množina
        const userSet = new Set(items);
        const missing = [...allowed].filter((x) => !userSet.has(x));
        const extra = [...userSet].filter((x) => !allowed.has(x));
        return {
          correct: items.length > 0 && missing.length === 0 && extra.length === 0,
          meta: { mode: 'set_exact', provided: items, missing, extra, allowedCount: allowed.size },
        };
      }

      // fallback: když někdo pošle object bez mode, beru to jako subset
      if (items.length === 0) return { correct: false, meta: { mode: 'object_fallback', reason: 'empty' } };
      const invalid = items.filter((x) => !allowed.has(x));
      return {
        correct: invalid.length === 0,
        meta: { mode: 'object_fallback', provided: items, invalid, allowedCount: allowed.size },
      };
    }

    // Neznámý typ answer
    return { correct: false, meta: { mode: 'unknown' } };
  };

  const checkAnswer = () => {
    if (!currentQuestion) return;

    const rawUser = answers[currentIndex] ?? '';
    const expected = currentQuestion.answer;

    const { correct, meta } = evaluate(rawUser, expected);

    setIsCorrect(correct);
    setShowResult(true);

    reportStreak(correct);
    logAttempt({ rawUser, correct, meta });

    if (correct) confetti();
  };

  // počítání výsledku musí používat stejnou evaluate() logiku (ne jen string === string)
  const finish = () => {
    const correctAnswers = questions.filter((q, i) => {
      const rawUser = answers[i] ?? '';
      const { correct } = evaluate(rawUser, q.answer);
      return correct;
    }).length;

    const score = questions.length > 0
      ? Math.round((correctAnswers / questions.length) * 100)
      : 0;

    const stars = score >= 80 ? 3 : score >= 60 ? 2 : 1;

    onComplete?.({ score, stars });
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setShowResult(false);
      setIsCorrect(null);
    } else {
      finish();
    }
  };

  const retry = () => {
    setShowResult(false);
    setIsCorrect(null);
    setAnswers((prev) => ({ ...prev, [currentIndex]: '' }));
  };

  if (!currentQuestion) {
    return <div className="text-center p-8">Žádné otázky k dispozici</div>;
  }

  const progressPercent = questions.length > 0
    ? Math.round(((currentIndex + 1) / questions.length) * 100)
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Otázka {currentIndex + 1} z {questions.length}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-lg shadow-slate-200/50"
        >
          <h3 className="text-xl md:text-2xl font-semibold text-slate-800 mb-6">
            {currentQuestion.question}
          </h3>

          <Input
            value={answers[currentIndex] || ''}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [currentIndex]: e.target.value }))}
            placeholder="Napiš odpověď..."
            className="text-lg md:text-xl p-6 rounded-2xl border-2 border-slate-200 focus:border-blue-400"
            disabled={showResult}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !showResult) checkAnswer();
            }}
          />

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-4 rounded-2xl flex items-center gap-3 ${
                isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-medium">Výborně! Správná odpověď!</span>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6" />
                  <span>
                    <span className="font-medium">Správná odpověď: </span>
                    {formatCorrectAnswerForReview(currentQuestion.answer)}
                  </span>
                </>
              )}
            </motion.div>
          )}

          <div className="mt-6 flex gap-3">
            {!showResult ? (
              <Button
                onClick={checkAnswer}
                disabled={!answers[currentIndex]}
                className="flex-1 h-14 text-lg rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                Zkontrolovat
              </Button>
            ) : (
              <>
                {!isCorrect && (
                  <Button
                    onClick={retry}
                    variant="outline"
                    className="h-14 px-6 rounded-2xl border-2"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Zkusit znovu
                  </Button>
                )}
                <Button
                  onClick={nextQuestion}
                  className="flex-1 h-14 text-lg rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                >
                  {currentIndex < questions.length - 1 ? (
                    <>
                      Další otázka
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  ) : (
                    'Dokončit'
                  )}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
