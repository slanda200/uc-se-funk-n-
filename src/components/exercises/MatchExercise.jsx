import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import confetti from '@/components/exercises/confetti';

export default function MatchExercise({
  exercise,
  onComplete,
  onStreak,
  onAnswerResult, // fallback
  onAttemptItem,  // ✅ NOVĚ (pro AttemptReview)
}) {
  const pairs = useMemo(() => exercise?.questions?.[0]?.pairs || [], [exercise]);

  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);

  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);

  const [matches, setMatches] = useState([]); // array of matched pair ids
  const [wrongMatch, setWrongMatch] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [errors, setErrors] = useState(0);

  // aby se timeout po unmountu nevolal
  const tRef = useRef(null);

  useEffect(() => {
    // reset při otevření cvičení
    const left = pairs.map((p, i) => ({ id: i, text: p.left, matched: false }));
    const right = [...pairs]
      .map((p, i) => ({ id: i, text: p.right, matched: false }))
      .sort(() => Math.random() - 0.5);

    setLeftItems(left);
    setRightItems(right);

    setSelectedLeft(null);
    setSelectedRight(null);
    setMatches([]);
    setWrongMatch(null);
    setIsComplete(false);
    setErrors(0);

    if (tRef.current) window.clearTimeout(tRef.current);
  }, [pairs]);

  useEffect(() => {
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, []);

  const reportStreak = (correct) => {
    // ✅ streak jen 1× (prefer onStreak, fallback onAnswerResult)
    if (onStreak) return onStreak(correct);
    onAnswerResult?.(correct);
  };

  const checkMatch = (left, right) => {
    const correct = left.id === right.id;

    // ✅ streak se počítá přesně 1× za pokus (až když jsou 2 vybrané)
    reportStreak(correct);

    // ✅ REVIEW ITEM (uložení pro AttemptReview)
    const correctPair = pairs?.[left.id];
    const expectedRight = correctPair?.right ?? null;

    onAttemptItem?.({
      index: matches.length + errors, // pořadí pokusu (ne otázky)
      type: 'match',
      prompt: 'Spoj správné dvojice',
      userAnswer: `${left.text} ↔ ${right.text}`,
      correctAnswer: expectedRight ? `${left.text} ↔ ${expectedRight}` : '(není definováno)',
      correct,
      explanation: correct
        ? 'Správně spojený pár.'
        : 'Tahle dvojice k sobě nepatří.',
    });

    if (correct) {
      setMatches((prev) => [...prev, left.id]);

      setLeftItems((prev) =>
        prev.map((l) => (l.id === left.id ? { ...l, matched: true } : l))
      );
      setRightItems((prev) =>
        prev.map((r) => (r.id === right.id ? { ...r, matched: true } : r))
      );

      setSelectedLeft(null);
      setSelectedRight(null);

      // dokončeno?
      const total = leftItems.length || pairs.length;
      const newMatchedCount = matches.length + 1;

      if (total > 0 && newMatchedCount === total) {
        confetti();
        setIsComplete(true);
      }
      return;
    }

    // špatně
    setWrongMatch({ left: left.id, right: right.id });
    setErrors((e) => e + 1);

    tRef.current = window.setTimeout(() => {
      setWrongMatch(null);
      setSelectedLeft(null);
      setSelectedRight(null);
    }, 800);
  };

  const handleLeftClick = (item) => {
    if (item.matched || isComplete) return;

    // když už je vybraný right, hned vyhodnoť
    if (selectedRight) {
      checkMatch(item, selectedRight);
      return;
    }

    setSelectedLeft(item);
  };

  const handleRightClick = (item) => {
    if (item.matched || isComplete) return;

    // když už je vybraný left, hned vyhodnoť
    if (selectedLeft) {
      checkMatch(selectedLeft, item);
      return;
    }

    setSelectedRight(item);
  };

  const handleComplete = () => {
    const totalPairs = leftItems.length;
    if (!totalPairs) return onComplete?.({ score: 0, stars: 0 });

    // jednoduché skóre: každá chyba = -20% / (chyby na pár)
    const score = Math.max(0, Math.round(100 - (errors / totalPairs) * 20));
    const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;
    onComplete?.({ score, stars });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-lg text-slate-600">Spoj k sobě správné páry</h3>
        <p className="text-sm text-slate-400">Klikni vlevo a potom na odpovídající vpravo</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Spojeno: {matches.length} z {leftItems.length}</span>
          <span>Chyby: {errors}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            animate={{
              width: `${leftItems.length ? (matches.length / leftItems.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-8">
        <div className="space-y-3">
          {leftItems.map((item) => (
            <motion.button
              key={`left-${item.id}`}
              onClick={() => handleLeftClick(item)}
              disabled={item.matched || isComplete}
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
              {item.matched && (
                <CheckCircle2 className="inline w-5 h-5 ml-2 text-emerald-500" />
              )}
            </motion.button>
          ))}
        </div>

        <div className="space-y-3">
          {rightItems.map((item) => (
            <motion.button
              key={`right-${item.id}`}
              onClick={() => handleRightClick(item)}
              disabled={item.matched || isComplete}
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
              {item.matched && (
                <CheckCircle2 className="inline w-5 h-5 ml-2 text-emerald-500" />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 text-center"
        >
          <div className="bg-emerald-50 rounded-2xl p-6 mb-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-xl font-bold text-emerald-700">Výborně!</h3>
            <p className="text-emerald-600">Všechny páry spojeny.</p>
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
