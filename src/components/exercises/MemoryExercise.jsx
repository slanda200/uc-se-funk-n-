import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import confetti from '@/components/exercises/confetti';

export default function MemoryExercise({ exercise, onComplete }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  useEffect(() => {
    initGame();
  }, [exercise]);
  
  const initGame = () => {
    const pairs = exercise.questions?.[0]?.pairs || [];
    
    // Create cards from pairs
    const cardPairs = pairs.flatMap((pair, index) => [
      { id: `${index}-a`, pairId: index, text: pair.left, type: 'left' },
      { id: `${index}-b`, pairId: index, text: pair.right, type: 'right' }
    ]);
    
    // Shuffle cards
    const shuffled = cardPairs.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setIsComplete(false);
  };
  
  const handleCardClick = (card) => {
    if (isChecking) return;
    if (flipped.includes(card.id)) return;
    if (matched.includes(card.pairId)) return;
    
    const newFlipped = [...flipped, card.id];
    setFlipped(newFlipped);
    
    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      setIsChecking(true);
      
      const firstCard = cards.find(c => c.id === newFlipped[0]);
      const secondCard = cards.find(c => c.id === newFlipped[1]);
      
      if (firstCard.pairId === secondCard.pairId && firstCard.type !== secondCard.type) {
        // Match found
        setTimeout(() => {
          const newMatched = [...matched, firstCard.pairId];
          setMatched(newMatched);
          setFlipped([]);
          setIsChecking(false);
          
          if (newMatched.length === cards.length / 2) {
            confetti();
            setIsComplete(true);
          }
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setFlipped([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  };
  
  const handleComplete = () => {
    // Pro pexeso vždy 100% a 3 hvězdičky při dokončení
    onComplete(100, 3);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-lg text-slate-600">Najdi správné páry</h3>
        <p className="text-sm text-slate-400">Otáčej karty a hledej k sobě patřící dvojice</p>
      </div>
      
      {/* Stats */}
      <div className="flex justify-center gap-6 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-700">{moves}</div>
          <div className="text-sm text-slate-500">Tahů</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{matched.length}</div>
          <div className="text-sm text-slate-500">Nalezeno</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-400">{cards.length / 2 - matched.length}</div>
          <div className="text-sm text-slate-500">Zbývá</div>
        </div>
      </div>

      {/* Memory grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.id);
          const isMatched = matched.includes(card.pairId);
          
          return (
            <motion.button
              key={card.id}
              onClick={() => handleCardClick(card)}
              whileHover={!isFlipped && !isMatched ? { scale: 1.05 } : {}}
              whileTap={!isFlipped && !isMatched ? { scale: 0.95 } : {}}
              className={`
                aspect-square rounded-2xl p-3 text-center font-medium text-sm md:text-base
                transition-all duration-300 transform
                ${isMatched 
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                  : isFlipped
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl cursor-pointer'
                }
              `}
              style={{
                perspective: '1000px',
              }}
            >
              {isFlipped || isMatched ? (
                <motion.span
                  initial={{ opacity: 0, rotateY: -90 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  className="flex items-center justify-center h-full"
                >
                  {card.text}
                  {isMatched && <CheckCircle2 className="w-4 h-4 ml-1 text-emerald-500" />}
                </motion.span>
              ) : (
                <span className="flex items-center justify-center h-full text-2xl">?</span>
              )}
            </motion.button>
          );
        })}
      </div>
      
      {/* Actions */}
      <div className="mt-6 flex justify-center gap-3">
        <Button
          onClick={initGame}
          variant="outline"
          className="h-12 px-6 rounded-2xl border-2"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Začít znovu
        </Button>
        
        {isComplete && (
          <Button
            onClick={handleComplete}
            className="h-12 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          >
            Dokončit
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
      
      {/* Complete message */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 text-center"
        >
          <div className="bg-emerald-50 rounded-2xl p-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-xl font-bold text-emerald-700">Skvělá práce!</h3>
            <p className="text-emerald-600">Všechny páry nalezeny za {moves} tahů!</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}