import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ArrowRight, Star } from 'lucide-react';
import confetti from './confetti';

export default function TestExercise({
  exercise,
  onComplete,

  // ✅ NOVĚ – kompatibilita s Play (review log + případně streak)
  onStreak,
  onAnswerResult, // fallback
  onAttemptItem,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalStars, setFinalStars] = useState(0);

  const current = exercise.questions[currentIndex];
  const totalQuestions = exercise.questions.length;

  // ✅ aby se attempt log neposlal víckrát
  const didLogRef = useRef(false);

  const normalize = (s) => (s ?? '').toString().trim().toLowerCase();

  // ⚠️ NOTE: Streak v testu nedává “live” smysl (uživatel může měnit odpovědi).
  // Proto tady streak NEPOSÍLÁME po každém kliknutí.
  // Kdybys chtěl streak i v testu, musel by test odpovědi “zamykat” po otázce.

  const handleAnswer = (answer) => {
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: answer,
    }));
  };

  const buildPrompt = (q) => {
    if (q.type === 'fill') return `Doplň: ${q.question}`;
    return q.question;
  };

  const logAttemptsOnce = () => {
    if (didLogRef.current) return;
    didLogRef.current = true;

    exercise.questions.forEach((q, idx) => {
      const userAnswer = answers[idx];
      const correct = normalize(userAnswer) === normalize(q.answer);

      onAttemptItem?.({
        index: idx,
        type: `test:${q.type || 'unknown'}`,
        prompt: buildPrompt(q),
        userAnswer: userAnswer ?? '(neodpovězeno)',
        correctAnswer: q.answer ?? '(není definováno)',
        correct,
        explanation: q.explanation || (correct ? 'Správně.' : 'Špatně.'),
        options: q.options || undefined,
      });
    });
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    // ✅ Calculate final score
    let correctCount = 0;
    exercise.questions.forEach((q, idx) => {
      const ua = answers[idx];
      if (normalize(ua) === normalize(q.answer)) correctCount++;
    });

    const score = Math.round((correctCount / totalQuestions) * 100);
    const stars = score >= 80 ? 3 : score >= 60 ? 2 : 1;

    setFinalScore(score);
    setFinalStars(stars);
    setShowReview(true);

    // ✅ uložíme všechny otázky do AttemptReview (jednou)
    logAttemptsOnce();

    if (score >= 70) confetti();
  };

  const handleFinish = () => {
    onComplete(finalScore, finalStars);
  };

  const renderQuestion = () => {
    const userAnswer = answers[currentIndex];

    if (current.type === 'decision' || current.type === 'quiz') {
      return (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">
            {current.question}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {current.options?.map((option, idx) => (
              <Button
                key={idx}
                onClick={() => handleAnswer(option)}
                variant={userAnswer === option ? 'default' : 'outline'}
                className={`h-14 text-lg ${
                  userAnswer === option ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''
                }`}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      );
    }

    if (current.type === 'fill') {
      return (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-800 mb-4 text-center">
            Doplň chybějící písmeno/slovo:
          </h3>
          <p className="text-2xl text-center mb-6 font-mono">{current.question}</p>
          <input
            type="text"
            value={userAnswer || ''}
            onChange={(e) => handleAnswer(e.target.value.toUpperCase())}
            className="w-full text-center text-2xl p-4 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
            placeholder="Tvoje odpověď..."
          />
        </div>
      );
    }

    return null;
  };

  // Review screen
  if (showReview) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Výsledky testu</h2>

          <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
            <div>
              <p className="text-sm text-slate-600">Tvoje úspěšnost</p>
              <p className="text-3xl font-bold text-slate-800">{finalScore}%</p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((star) => (
                <motion.div
                  key={star}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: star * 0.1 }}
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= finalStars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'
                    }`}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-700 mb-4">Přehled odpovědí</h3>

          <div className="space-y-4">
            {exercise.questions.map((q, idx) => {
              const userAnswer = answers[idx];
              const isCorrect = normalize(userAnswer) === normalize(q.answer);

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 rounded-xl border-2 ${
                    isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isCorrect ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 mb-2">
                        {idx + 1}. {q.question}
                      </p>
                      <div className="text-sm space-y-1">
                        <p className="text-slate-600">
                          <span className="font-medium">Tvoje odpověď:</span>{' '}
                          <span className={isCorrect ? 'text-emerald-700' : 'text-red-700'}>
                            {userAnswer || '(neodpovězeno)'}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-emerald-700">
                            <span className="font-medium">Správná odpověď:</span> {q.answer}
                          </p>
                        )}
                        {/* ✅ vysvětlivka */}
                        {(q.explanation || '') && (
                          <p className="text-slate-500">
                            <span className="font-medium">Vysvětlení:</span> {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Button
            onClick={handleFinish}
            className="w-full mt-6 h-14 text-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
          >
            Dokončit test
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>Otázka {currentIndex + 1} z {totalQuestions}</span>
          <span>Odpovězeno: {Object.keys(answers).length}/{totalQuestions}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-2xl p-8 shadow-lg mb-6"
        >
          {renderQuestion()}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3">
        {currentIndex > 0 && (
          <Button onClick={() => setCurrentIndex(currentIndex - 1)} variant="outline" className="flex-1">
            Zpět
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!answers[currentIndex]}
          className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
        >
          {currentIndex < totalQuestions - 1 ? (
            <>
              Další <ArrowRight className="w-5 h-5 ml-2" />
            </>
          ) : (
            'Dokončit test'
          )}
        </Button>
      </div>
    </div>
  );
}
