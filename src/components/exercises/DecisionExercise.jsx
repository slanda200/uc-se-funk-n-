import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import confetti from './confetti';

export default function DecisionExercise({
  exercise,
  onComplete,
  onStreak,
  onAnswerResult,
  onAttemptItem,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const current = exercise?.questions?.[currentIndex];

  const explanationText = (
    current?.explanation ??
    current?.explanationText ??
    current?.note ??
    current?.reason ??
    ""
  ).toString().trim();

  const timerRef = useRef(null);

  const reportStreak = (correct) => {
    if (onStreak) onStreak(correct);
    else onAnswerResult?.(correct);
  };

  const handleAnswer = (selected) => {
    if (!current || feedback !== null) return;

    const isCorrect = selected === current.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    reportStreak(isCorrect);

    onAttemptItem?.({
      index: currentIndex,
      type: 'decision',
      prompt: current.question,
      userAnswer: selected,
      correctAnswer: current.answer,
      correct: isCorrect,
      ...(explanationText ? { explanation: explanationText } : {}),
      options: current.options || [],
    });

    if (isCorrect) {
      setScore((s) => s + 1);
      confetti();
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (currentIndex < exercise.questions.length - 1) {
        setCurrentIndex((i) => i + 1);
        setFeedback(null);
      } else {
        const finalScore = Math.round(
          ((score + (isCorrect ? 1 : 0)) / exercise.questions.length) * 100
        );
        const stars = finalScore >= 80 ? 3 : finalScore >= 60 ? 2 : 1;
        onComplete?.(finalScore, stars);
      }
    }, 1200);
  };

  if (!current) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>
            Otázka {currentIndex + 1} z {exercise.questions.length}
          </span>
          <span>
            Skóre: {score}/{exercise.questions.length}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{
              width: `${((currentIndex + 1) / exercise.questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-2xl p-8 shadow-lg"
        >
          <h3 className="text-2xl font-bold text-slate-800 mb-8 text-center">
            {current.question}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {(current.options || []).map((option, idx) => {
              const isCorrectOption = option === current.answer;

              let btnClass =
                'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600';

              if (feedback === 'correct' && isCorrectOption) {
                btnClass = 'bg-emerald-500 hover:bg-emerald-600';
              }

              if (feedback === 'wrong') {
                btnClass = isCorrectOption
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-red-500 hover:bg-red-600';
              }

              return (
                <Button
                  key={idx}
                  onClick={() => handleAnswer(option)}
                  disabled={feedback !== null}
                  className={`h-20 text-lg rounded-xl ${btnClass}`}
                >
                  {option}
                </Button>
              );
            })}
          </div>

          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 p-4 rounded-xl flex items-center gap-3 ${
                feedback === 'correct'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {feedback === 'correct' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}

              <div className="flex flex-col">
                <span className="font-medium">
                  {feedback === 'correct'
                    ? 'Správně.'
                    : `Správná odpověď: ${current.answer}`}
                </span>

                {explanationText && (
                  <span className="text-sm mt-1 opacity-90">{explanationText}</span>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
