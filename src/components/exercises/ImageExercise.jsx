import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, ImageIcon } from 'lucide-react';
import confetti from '@/components/exercises/confetti';

export default function ImageExercise({ exercise, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  
  const questions = exercise.questions || [];
  const currentQuestion = questions[currentIndex];
  
  const checkAnswer = () => {
    const userAnswer = (answers[currentIndex] || '').trim().toLowerCase();
    const correctAnswer = currentQuestion.answer.toLowerCase();
    const correct = userAnswer === correctAnswer;
    
    setIsCorrect(correct);
    setShowResult(true);
    
    if (correct) {
      confetti();
    }
  };
  
  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowResult(false);
      setIsCorrect(null);
    } else {
      // Calculate final score
      const correctAnswers = questions.filter((q, i) => 
        (answers[i] || '').trim().toLowerCase() === q.answer.toLowerCase()
      ).length;
      const score = Math.round((correctAnswers / questions.length) * 100);
      const stars = score >= 80 ? 3 : score >= 60 ? 2 : 1;
      onComplete({ score, stars });
    }
  };
  
  const retry = () => {
    setShowResult(false);
    setIsCorrect(null);
    setAnswers({ ...answers, [currentIndex]: '' });
  };

  if (!currentQuestion) {
    return <div className="text-center p-8">Žádné otázky k dispozici</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Obrázek {currentIndex + 1} z {questions.length}</span>
          <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-lg shadow-slate-200/50"
        >
          <h3 className="text-xl md:text-2xl font-semibold text-slate-800 mb-4 text-center">
            {currentQuestion.question || 'Co vidíš na obrázku?'}
          </h3>
          
          {/* Image */}
          <div className="mb-6 rounded-2xl overflow-hidden bg-slate-100">
            {currentQuestion.image_url ? (
              <img 
                src={currentQuestion.image_url} 
                alt="Obrázek úlohy"
                className="w-full h-64 object-cover"
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center">
                <ImageIcon className="w-16 h-16 text-slate-300" />
              </div>
            )}
          </div>
          
          <Input
            value={answers[currentIndex] || ''}
            onChange={(e) => setAnswers({ ...answers, [currentIndex]: e.target.value })}
            placeholder="Napiš, co vidíš..."
            className="text-lg md:text-xl p-6 rounded-2xl border-2 border-slate-200 focus:border-orange-400"
            disabled={showResult}
            onKeyPress={(e) => e.key === 'Enter' && !showResult && checkAnswer()}
          />
          
          {/* Result feedback */}
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
                    {currentQuestion.answer}
                  </span>
                </>
              )}
            </motion.div>
          )}
          
          {/* Actions */}
          <div className="mt-6 flex gap-3">
            {!showResult ? (
              <Button
                onClick={checkAnswer}
                disabled={!answers[currentIndex]}
                className="flex-1 h-14 text-lg rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
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
                      Další obrázek
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