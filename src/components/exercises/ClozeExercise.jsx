import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import confetti from './confetti';

// Fisher–Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(v) {
  return (v ?? '').toString().trim().toLowerCase();
}

// pomocná funkce: šířka mezery podle délky textu (v "ch" = šířka znaku)
function gapMinWidthCh(value) {
  const s = (value ?? '').toString();
  // pro písmeno chceme malé (např. 2ch), pro slova to poroste
  const ch = Math.max(2, Math.min(18, s.length + 1)); // strop 18ch kvůli rozbití layoutu
  return `${ch}ch`;
}

// animace pro "správně / špatně" na gapu po kontrole
function resultAnim(isCorrect) {
  if (isCorrect) {
    return {
      scale: [1, 1.08, 1],
      transition: { type: 'spring', stiffness: 500, damping: 18 },
    };
  }
  return {
    x: [0, -4, 4, -3, 3, 0],
    transition: { duration: 0.22 },
  };
}

// ✅ přidán onStreak + onAttemptItem
export default function ClozeExercise({ exercise, onComplete, onStreak, onAttemptItem }) {
  const pickCount = Number.isFinite(exercise?.pickCount) ? exercise.pickCount : 12;

  const questions = useMemo(() => {
    const all = Array.isArray(exercise?.questions) ? exercise.questions : [];
    if (all.length === 0) return [];
    const shuffled = shuffle(all);
    return shuffled.slice(0, Math.min(pickCount, shuffled.length));
  }, [exercise?.id]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [activeGap, setActiveGap] = useState(null);
  const [lastCorrect, setLastCorrect] = useState(null);

  const current = questions[currentIndex];

  const handleAnswerChange = (gapIndex, value) => {
    setUserAnswers((prev) => ({ ...prev, [gapIndex]: value }));
    setActiveGap(null);
  };

  const gradeCurrent = () => {
    const correctAnswers = (current?.answer ?? '').split('___');
    const parts = (current?.text ?? '').split('___');
    const gapCount = Math.max(0, parts.length - 1);

    let correct = 0;
    for (let i = 0; i < gapCount; i++) {
      const ua = norm(userAnswers[i]);
      const ca = norm(correctAnswers[i]);
      if (ua === ca) correct++;
    }

    const isAllCorrect = gapCount > 0 ? (correct === gapCount) : false;
    return { isAllCorrect, gapCount, correctAnswers };
  };

  const buildUserAnswerString = (gapCount) => {
    const arr = [];
    for (let i = 0; i < gapCount; i++) arr.push((userAnswers[i] ?? '').toString().trim());
    return arr.join(' | ');
  };

  const buildCorrectAnswerString = (correctAnswers, gapCount) => {
    const arr = [];
    for (let i = 0; i < gapCount; i++) arr.push((correctAnswers[i] ?? '').toString().trim());
    return arr.join(' | ');
  };

  const handleCheck = () => {
    if (!current) return;

    const { isAllCorrect, gapCount, correctAnswers } = gradeCurrent();

    setLastCorrect(isAllCorrect);
    setShowResult(true);

    // ✅ STREAK
    onStreak?.(isAllCorrect);

    // ✅ REVIEW ITEM
    const prompt = current?.text ?? '';
    const userAnswerStr = buildUserAnswerString(gapCount);
    const correctAnswerStr = buildCorrectAnswerString(correctAnswers, gapCount);
    const explanationText =
      current?.explanation ||
      (isAllCorrect ? 'Skvěle jen tak dál :)' : 'Bohužel teď to nevyšlo :( ');

    onAttemptItem?.({
      index: currentIndex,
      prompt,
      userAnswer: userAnswerStr || '(prázdné)',
      correctAnswer: correctAnswerStr || '(není definováno)',
      correct: isAllCorrect,
      explanation: explanationText,
      type: 'cloze',
    });

    if (isAllCorrect) {
      confetti();
      setScore((s) => s + 1);
    }
  };

  const handleContinue = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setUserAnswers({});
      setShowResult(false);
      setLastCorrect(null);
      setActiveGap(null);
    } else {
      const total = questions.length || 1;
      const finalScore = Math.round((score / total) * 100);
      const stars = finalScore >= 80 ? 3 : finalScore >= 60 ? 2 : 1;
      onComplete?.(finalScore, stars);
    }
  };

  const handleFix = () => {
    setShowResult(false);
    setLastCorrect(null);
    setActiveGap(null);
  };

  const renderTextWithGaps = () => {
    const parts = (current?.text ?? '').split('___');
    const correctAnswers = (current?.answer ?? '').split('___');
    const gapCount = Math.max(0, parts.length - 1);
    const hasOptions = Array.isArray(current?.options) && current.options.length > 0;

    return (
      <div className="text-2xl leading-relaxed">
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            <span>{part}</span>

            {idx < gapCount && (
              hasOptions ? (
                <span className="relative inline-block align-baseline mx-1">
                  {/* 1) Když je vyplněno a není otevřeno: ukázat vybranou odpověď */}
                  {userAnswers[idx] && activeGap !== idx ? (
                    <motion.button
                      onClick={() => !showResult && setActiveGap(idx)}
                      disabled={showResult}
                      whileTap={!showResult ? { scale: 0.96 } : undefined}
                      whileHover={!showResult ? { y: -1 } : undefined}
                      animate={
                        showResult
                          ? resultAnim(norm(userAnswers[idx]) === norm(correctAnswers[idx]))
                          : { scale: 1 }
                      }
                      className={`inline-flex items-center justify-center
                        h-8 px-2 rounded-md font-bold text-xl leading-none
                        transition-colors
                        ${
                          showResult
                            ? (norm(userAnswers[idx]) === norm(correctAnswers[idx])
                                ? 'bg-emerald-500 text-white'
                                : 'bg-red-500 text-white')
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      style={{ minWidth: gapMinWidthCh(userAnswers[idx]) }}
                    >
                      {userAnswers[idx]}
                    </motion.button>
                  ) : (
                    <>
                      {/* 2) Otevřené možnosti */}
                      <AnimatePresence initial={false}>
                        {activeGap === idx && !showResult ? (
                          <motion.span
                            key="options"
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                            className="inline-flex gap-1 flex-wrap"
                          >
                            {current.options.map((option, optIdx) => (
                              <motion.button
                                key={optIdx}
                                onClick={() => handleAnswerChange(idx, option)}
                                whileTap={{ scale: 0.95 }}
                                whileHover={{ y: -1 }}
                                className="h-8 px-2 inline-flex items-center justify-center
                                           rounded-md font-medium text-base
                                           bg-slate-200 text-slate-700 hover:bg-slate-300"
                                style={{ minWidth: gapMinWidthCh(option) }}
                              >
                                {option}
                              </motion.button>
                            ))}
                          </motion.span>
                        ) : null}
                      </AnimatePresence>

                      {/* 3) Prázdná mezera (nevyplněno) */}
                      {activeGap !== idx && (
                        <motion.button
                          onClick={() => !showResult && setActiveGap(idx)}
                          disabled={showResult}
                          whileTap={!showResult ? { scale: 0.96 } : undefined}
                          whileHover={!showResult ? { y: -1 } : undefined}
                          className="inline-flex items-center justify-center
                                     h-8 px-2 rounded-md
                                     font-bold text-base
                                     border-2 border-dashed border-slate-400
                                     bg-slate-100 text-slate-400
                                     hover:border-blue-400 hover:bg-blue-50"
                          // prázdný gap je malý (2ch), ale pořád jako tlačítko
                          style={{ minWidth: gapMinWidthCh('') }}
                        >
                          _
                        </motion.button>
                      )}
                    </>
                  )}
                </span>
              ) : (
                <Input
                  value={userAnswers[idx] || ''}
                  onChange={(e) => handleAnswerChange(idx, e.target.value)}
                  disabled={showResult}
                  className={`inline-block mx-1 text-center text-lg font-medium ${
                    showResult
                      ? (norm(userAnswers[idx]) === norm(correctAnswers[idx])
                          ? 'bg-emerald-100 border-emerald-500'
                          : 'bg-red-100 border-red-500')
                      : ''
                  }`}
                  // auto šířka i pro input (když někdy budeš psát slovo)
                  style={{ width: gapMinWidthCh(userAnswers[idx] || '') }}
                />
              )
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (!current) {
    return <div className="text-center p-8">Žádné otázky k dispozici</div>;
  }

  const total = questions.length;

  const isReadyToCheck = (() => {
    const parts = (current?.text ?? '').split('___');
    const gapCount = Math.max(0, parts.length - 1);
    const filledGaps = Object.values(userAnswers).filter((v) => v && v.toString().trim()).length;
    return gapCount > 0 && filledGaps === gapCount;
  })();

  const explanationText =
    current.explanation ||
    (lastCorrect ? 'Skvěle jen tak dál :)' : 'Bohužel teď to nevyšlo :( ');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>Text {currentIndex + 1} z {total}</span>
          <span>Skóre: {score}/{total}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <p className="text-sm text-slate-600 mb-6">
          Klikni na správnou variantu do mezer:
        </p>

        <div className="mb-6 bg-slate-50 p-6 rounded-xl">
          {renderTextWithGaps()}
        </div>

        {!showResult && isReadyToCheck && (
          <Button
            onClick={handleCheck}
            className="w-full h-12 text-lg bg-gradient-to-r from-blue-500 to-purple-500"
          >
            Zkontrolovat
          </Button>
        )}

        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg flex items-start gap-3 ${
              lastCorrect ? 'bg-emerald-50' : 'bg-red-50'
            }`}
          >
            {lastCorrect ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}

            <div className="flex-1">
              <div className={`font-medium ${lastCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                {lastCorrect ? 'Správně! 🎉' : 'Špatně.'}
              </div>

              <div className="text-slate-700 mt-1 text-sm">
                {explanationText}
              </div>
            </div>

            <div className="flex gap-2">
              {!lastCorrect && (
                <Button variant="outline" className="border-2" onClick={handleFix}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Opravit
                </Button>
              )}
              <Button onClick={handleContinue}>
                Pokračovat
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
