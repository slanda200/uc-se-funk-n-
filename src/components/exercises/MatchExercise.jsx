import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ArrowRight, Shuffle } from 'lucide-react';
import confetti from '@/components/exercises/confetti';

export default function MatchExercise({ exercise, onComplete }) {
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  const [matches, setMatches] = useState([]);
  const [wrongMatch, setWrongMatch] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [errors, setErrors] = useState(0);
  
  useEffect(() => {
    const pairs = exercise.questions?.[0]?.pairs || [];
    setLeftItems(pairs.map((p, i) => ({ id: i, text: p.left, matched: false })));
    
    // Shuffle right items
    const shuffled = [...pairs]
      .map((p, i) => ({ id: i, text: p.right, matched: false }))
      .sort(() => Math.random() - 0.5);
    setRightItems(shuffled);
  }, [exercise]);
  
  const handleLeftClick = (item) => {
    if (item.matched) return;
    setSelectedLeft(item);
    
    if (selectedRight) {
      checkMatch(item, selectedRight);
    }
  };
  
  const handleRightClick = (item) => {
    if (item.matched) return;
    setSelectedRight(item);
    
    if (selectedLeft) {
      checkMatch(selectedLeft, item);
    }
  };
  
  const checkMatch = (left, right) => {
    if (left.id === right.id) {
      // Correct match
      setMatches([...matches, left.id]);
      setLeftItems(leftItems.map(l => l.id === left.id ? { ...l, matched: true } : l));
      setRightItems(rightItems.map(r => r.id === right.id ? { ...r, matched: true } : r));
      setSelectedLeft(null);
      setSelectedRight(null);
      
      // Check if complete
      if (matches.length + 1 === leftItems.length) {
        confetti();
        setIsComplete(true);
      }
    } else {
      // Wrong match
      setWrongMatch({ left: left.id, right: right.id });
      setErrors(errors + 1);
      setTimeout(() => {
        setWrongMatch(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 800);
    }
  };
  
  const handleComplete = () => {
    const totalPairs = leftItems.length;
    const score = Math.max(0, Math.round(100 - (errors / totalPairs) * 20));
    const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;
    onComplete({ score, stars });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-lg text-slate-600">Spoj k sobě správné páry</h3>
        <p className="text-sm text-slate-400">Klikni na položku vlevo a pak na odpovídající vpravo</p>
      </div>
      
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Spojeno: {matches.length} z {leftItems.length}</span>
          <span>Chyby: {errors}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            animate={{ width: `${(matches.length / leftItems.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Matching area */}
      <div className="grid grid-cols-2 gap-4 md:gap-8">
        {/* Left column */}
        <div className="space-y-3">
          {leftItems.map((item) => (
            <motion.button
              key={`left-${item.id}`}
              onClick={() => handleLeftClick(item)}
              disabled={item.matched}
              whileHover={!item.matched ? { scale: 1.02 } : {}}
              whileTap={!item.matched ? { scale: 0.98 } : {}}
              className={`
                w-full p-4 rounded-2xl text-left font-medium transition-all
                ${item.matched 
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' 
                  : selectedLeft?.id === item.id
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-400 shadow-lg'
                    : wrongMatch?.left === item.id
                      ? 'bg-red-100 text-red-700 border-2 border-red-400'
                      : 'bg-white border-2 border-slate-200 hover:border-blue-300 hover:shadow-md'
                }
              `}
            >
              {item.text}
              {item.matched && <CheckCircle2 className="inline w-5 h-5 ml-2 text-emerald-500" />}
            </motion.button>
          ))}
        </div>
        
        {/* Right column */}
        <div className="space-y-3">
          {rightItems.map((item) => (
            <motion.button
              key={`right-${item.id}`}
              onClick={() => handleRightClick(item)}
              disabled={item.matched}
              whileHover={!item.matched ? { scale: 1.02 } : {}}
              whileTap={!item.matched ? { scale: 0.98 } : {}}
              className={`
                w-full p-4 rounded-2xl text-left font-medium transition-all
                ${item.matched 
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' 
                  : selectedRight?.id === item.id
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-400 shadow-lg'
                    : wrongMatch?.right === item.id
                      ? 'bg-red-100 text-red-700 border-2 border-red-400'
                      : 'bg-white border-2 border-slate-200 hover:border-blue-300 hover:shadow-md'
                }
              `}
            >
              {item.text}
              {item.matched && <CheckCircle2 className="inline w-5 h-5 ml-2 text-emerald-500" />}
            </motion.button>
          ))}
        </div>
      </div>
      
      {/* Complete button */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 text-center"
        >
          <div className="bg-emerald-50 rounded-2xl p-6 mb-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-xl font-bold text-emerald-700">Výborně!</h3>
            <p className="text-emerald-600">Všechny páry spojeny správně!</p>
          </div>
          <Button
            onClick={handleComplete}
            className="h-14 px-8 text-lg rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          >
            Dokončit cvičení
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}