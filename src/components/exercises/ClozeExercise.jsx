import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle } from 'lucide-react';
import confetti from './confetti';

export default function ClozeExercise({ exercise, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [activeGap, setActiveGap] = useState(null);

  const current = exercise.questions[currentIndex];

  const handleAnswerChange = (gapIndex, value) => {
    setUserAnswers(prev => ({
      ...prev,
      [gapIndex]: value
    }));
    setActiveGap(null);
  };

  const handleCheck = () => {
    const correctAnswers = current.answer?.split('___') || [];
    const parts = current.text?.split('___') || [];
    const gapCount = parts.length - 1;
    let correct = 0;
    
    for (let i = 0; i < gapCount; i++) {
      const userAnswer = (userAnswers[i] || '').trim().toLowerCase();
      const correctAnswer = (correctAnswers[i] || '').trim().toLowerCase();
      if (userAnswer === correctAnswer) {
        correct++;
      }
    }

    const isAllCorrect = correct === gapCount;
    if (isAllCorrect) {
      confetti();
      setScore(score + 1);
    }
    setShowResult(true);

    setTimeout(() => {
      if (currentIndex < exercise.questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setUserAnswers({});
        setShowResult(false);
      } else {
        const finalScore = Math.round(((score + (isAllCorrect ? 1 : 0)) / exercise.questions.length) * 100);
        const stars = finalScore >= 80 ? 3 : finalScore >= 60 ? 2 : 1;
        onComplete(finalScore, stars);
      }
    }, 2500);
  };

  const renderTextWithGaps = () => {
    const parts = current.text?.split('___') || [];
    const correctAnswers = current.answer?.split('___') || [];
    const gapCount = parts.length - 1;
    const hasOptions = current.options && current.options.length > 0;
    
    return (
      <div className="text-xl leading-relaxed">
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            <span>{part}</span>
            {idx < gapCount && (
              hasOptions ? (
                <span className="relative inline-block mx-2">
                  {userAnswers[idx] && activeGap !== idx ? (
                    <button
                      onClick={() => !showResult && setActiveGap(idx)}
                      disabled={showResult}
                      className={`px-4 py-2 rounded-lg font-bold text-lg min-w-[60px] ${
                        showResult
                          ? (userAnswers[idx].toLowerCase() === correctAnswers[idx].toLowerCase()
                              ? 'bg-emerald-500 text-white'
                              : 'bg-red-500 text-white')
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {userAnswers[idx]}
                    </button>
                  ) : activeGap === idx && !showResult ? (
                    <span className="inline-flex gap-2 flex-wrap">
                      {current.options.map((option, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => handleAnswerChange(idx, option)}
                          className="px-4 py-2 rounded-lg font-medium transition-all text-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                        >
                          {option}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <button
                      onClick={() => !showResult && setActiveGap(idx)}
                      disabled={showResult}
                      className="px-4 py-2 rounded-lg font-bold text-lg min-w-[60px] border-2 border-dashed border-slate-400 bg-slate-100 text-slate-400 hover:border-blue-400 hover:bg-blue-50"
                    >
                      ___
                    </button>
                  )}
                </span>
              ) : (
                <Input
                  value={userAnswers[idx] || ''}
                  onChange={(e) => handleAnswerChange(idx, e.target.value)}
                  disabled={showResult}
                  className={`inline-block w-32 mx-2 text-center text-lg font-medium ${
                    showResult 
                      ? (userAnswers[idx]?.trim().toLowerCase() === correctAnswers[idx]?.trim().toLowerCase()
                          ? 'bg-emerald-100 border-emerald-500'
                          : 'bg-red-100 border-red-500')
                      : ''
                  }`}
                />
              )
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>Text {currentIndex + 1} z {exercise.questions.length}</span>
          <span>Skóre: {score}/{exercise.questions.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <p className="text-sm text-slate-600 mb-6">
          Klikni na správnou variantu do mezer:
        </p>

        <div className="mb-6 bg-slate-50 p-6 rounded-xl">
          {renderTextWithGaps()}
        </div>

        {!showResult && (() => {
          const parts = current.text?.split('___') || [];
          const gapCount = parts.length - 1;
          const filledGaps = Object.values(userAnswers).filter(v => v && v.trim()).length;
          return filledGaps === gapCount;
        })() && (
          <Button onClick={handleCheck} className="w-full h-12 text-lg bg-gradient-to-r from-blue-500 to-purple-500">
            Zkontrolovat
          </Button>
        )}

        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 rounded-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-emerald-700 font-medium">
              Hotovo! 🎉
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}