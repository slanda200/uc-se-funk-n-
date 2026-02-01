import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import confetti from '@/components/exercises/confetti';

export default function QuizExercise({
  exercise,
  onComplete,
  onStreak,
  onAnswerResult, // fallback
  onAttemptItem,  // ✅ REVIEW
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const questions = exercise.questions || [];
  const currentQuestion = questions[currentIndex];

  const reportStreak = (correct) => {
    onStreak?.(correct);
    onAnswerResult?.(correct);
  };

  const checkAnswer = (answer) => {
    if (!currentQuestion || showResult) return;

    const correct = answer === currentQuestion.answer;

    setSelectedAnswer(answer);
    setShowResult(true);

    // ✅ streak
    reportStreak(correct);

    if (correct) {
      setCorrectCount((c) => c + 1);
      confetti();
    }

    // ✅ REVIEW ITEM (tohle je to, co ti chybělo)
    onAttemptItem?.({
      index: currentIndex,
      type: "quiz",
      prompt: currentQuestion.question || "",
      userAnswer: answer,
      correctAnswer: currentQuestion.answer ?? "",
      correct,
      explanation:
        currentQuestion.explanation ||
        (correct ? "Správně ✅" : "Špatně ❌"),
    });
  };

  const nextQuestion = () => {
    if (!currentQuestion) return;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      return;
    }

    const score = Math.round((correctCount / questions.length) * 100);
    const stars = score >= 80 ? 3 : score >= 60 ? 2 : 1;
    onComplete?.({ score, stars });
  };

  if (!currentQuestion) {
    return <div className="text-center p-8">Žádné otázky k dispozici</div>;
  }

  const options = currentQuestion.options || [];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Otázka {currentIndex + 1} z {questions.length}</span>
          <span>{correctCount} správně</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
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

          <div className="grid gap-3">
            {options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === currentQuestion.answer;
              const showCorrectHighlight = showResult && isCorrect;
              const showWrongHighlight = showResult && isSelected && !isCorrect;

              return (
                <motion.button
                  key={index}
                  onClick={() => !showResult && checkAnswer(option)}
                  disabled={showResult}
                  whileHover={!showResult ? { scale: 1.01 } : {}}
                  whileTap={!showResult ? { scale: 0.99 } : {}}
                  className={`
                    w-full p-4 md:p-5 rounded-2xl text-left font-medium transition-all
                    flex items-center justify-between
                    ${showCorrectHighlight
                      ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400'
                      : showWrongHighlight
                        ? 'bg-red-100 text-red-700 border-2 border-red-400'
                        : isSelected
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                          : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent hover:border-slate-200'
                    }
                  `}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${showCorrectHighlight
                          ? 'bg-emerald-200 text-emerald-700'
                          : showWrongHighlight
                            ? 'bg-red-200 text-red-700'
                            : 'bg-slate-200 text-slate-600'
                        }
                      `}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </span>

                  {showCorrectHighlight && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                  {showWrongHighlight && <XCircle className="w-6 h-6 text-red-500" />}
                </motion.button>
              );
            })}
          </div>

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <Button
                onClick={nextQuestion}
                className="w-full h-14 text-lg rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
