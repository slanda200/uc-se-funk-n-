import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import confetti from './confetti';

export default function AnalysisExercise({ exercise, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWords, setSelectedWords] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const current = exercise.questions[currentIndex];
  const availableColors = current.words?.map(w => w.color).filter((v, i, a) => a.indexOf(v) === i) || [];

  const handleWordClick = (wordIndex) => {
    if (showResult) return;
    
    const currentColor = selectedWords[wordIndex];
    const currentColorIndex = availableColors.indexOf(currentColor);
    const nextColorIndex = (currentColorIndex + 1) % availableColors.length;
    
    setSelectedWords(prev => ({
      ...prev,
      [wordIndex]: availableColors[nextColorIndex]
    }));
  };

  const handleCheck = () => {
    let correctCount = 0;
    let totalCount = current.words?.length || 0;
    
    current.words?.forEach((word, idx) => {
      if (selectedWords[idx] === word.color) {
        correctCount++;
      }
    });

    const questionScore = Math.round((correctCount / totalCount) * 100);
    if (questionScore === 100) {
      confetti();
      setScore(score + 1);
    }
    setShowResult(true);

    setTimeout(() => {
      if (currentIndex < exercise.questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setSelectedWords({});
        setShowResult(false);
      } else {
        const finalScore = Math.round(((score + (questionScore === 100 ? 1 : 0)) / exercise.questions.length) * 100);
        const stars = finalScore >= 80 ? 3 : finalScore >= 60 ? 2 : 1;
        onComplete(finalScore, stars);
      }
    }, 2500);
  };

  const handleRetry = () => {
    setSelectedWords({});
    setShowResult(false);
  };

  const getColorClass = (color) => {
    const colorMap = {
      'red': 'bg-red-200',
      'blue': 'bg-blue-200',
      'green': 'bg-green-200',
      'yellow': 'bg-yellow-200',
      'purple': 'bg-purple-200',
      'orange': 'bg-orange-200'
    };
    return colorMap[color] || 'bg-gray-200';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>Úkol {currentIndex + 1} z {exercise.questions.length}</span>
          <span>Skóre: {score}/{exercise.questions.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-slate-800 mb-4">{current.question}</h3>
        
        <p className="text-sm text-slate-600 mb-4">
          Klikni na slova a obarvi je správnou barvou (klikáním měníš barvy):
        </p>

        {/* Color legend with meanings */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {availableColors.map((color, idx) => (
            <div key={idx} className={`px-4 py-2 rounded-lg ${getColorClass(color)} text-sm font-medium`}>
              {color === 'red' ? '🔴 Červená = Samohlásky' : color === 'blue' ? '🔵 Modrá = Souhlásky' : color}
            </div>
          ))}
        </div>

        {/* Sentence with clickable words */}
        <div className="text-2xl leading-relaxed mb-6 bg-slate-50 p-6 rounded-xl">
          {current.text?.split(' ').map((wordText, textIdx) => {
            const wordIndex = current.words?.findIndex((w, i) => {
              const wordsBefore = current.text.split(' ').slice(0, textIdx).filter(wt => 
                current.words.slice(0, i).some(wd => wd.word === wt)
              ).length;
              const currentWordMatches = current.words.slice(0, i + 1).filter(wd => wd.word === wordText).length;
              const textWordMatches = current.text.split(' ').slice(0, textIdx + 1).filter(wt => wt === wordText).length;
              return w.word === wordText && currentWordMatches === textWordMatches;
            });
            
            if (wordIndex !== -1) {
              const wordData = current.words[wordIndex];
              const selected = selectedWords[wordIndex];
              const isCorrect = showResult && selected === wordData.color;
              const isWrong = showResult && selected && selected !== wordData.color;
              
              return (
                <span
                  key={textIdx}
                  onClick={() => handleWordClick(wordIndex)}
                  className={`inline-block px-3 py-2 mx-1 my-1 rounded-lg cursor-pointer transition-all font-bold ${
                    selected ? getColorClass(selected) : 'hover:bg-slate-200 bg-white border-2 border-slate-300'
                  } ${isCorrect ? 'ring-4 ring-green-500' : ''} ${isWrong ? 'ring-4 ring-red-500' : ''}`}
                >
                  {wordText}
                  {showResult && (
                    isCorrect ? <CheckCircle2 className="w-5 h-5 inline ml-1 text-green-600" /> 
                    : isWrong ? <XCircle className="w-5 h-5 inline ml-1 text-red-600" /> : null
                  )}
                </span>
              );
            }
            return <span key={textIdx} className="mx-1">{wordText}</span>;
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!showResult && Object.keys(selectedWords).length === current.words?.length && (
            <Button onClick={handleCheck} className="flex-1 h-12 text-lg bg-gradient-to-r from-blue-500 to-purple-500">
              Zkontrolovat
            </Button>
          )}
          {showResult && (
            <Button onClick={handleRetry} variant="outline" className="h-12 px-6 rounded-2xl border-2">
              <RotateCcw className="w-5 h-5 mr-2" />
              Opravit
            </Button>
          )}
        </div>

        {/* Result */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-slate-50"
          >
            {(() => {
              const correctCount = Object.keys(selectedWords).filter(idx => {
                const wordData = current.words[idx];
                return selectedWords[idx] === wordData?.color;
              }).length;
              const totalCount = current.words?.length || 0;
              const percentage = Math.round((correctCount / totalCount) * 100);
              
              return (
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">
                    {correctCount} / {totalCount} správně ({percentage}%)
                  </p>
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>
    </div>
  );
}