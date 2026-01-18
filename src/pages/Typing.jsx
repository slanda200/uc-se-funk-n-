import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Keyboard, RotateCcw, Trophy, Timer, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from '@/components/exercises/confetti';

const lessons = [
  { id: 1, name: 'Základní řada', keys: 'asdfjklů', text: 'asdf jklů asdf jklů as jk df lů' },
  { id: 2, name: 'Horní řada', keys: 'qwertzuiop', text: 'qwer tzui op qwer tzui op we ui' },
  { id: 3, name: 'Dolní řada', keys: 'yxcvbnm', text: 'yxcv bnm yxcv bnm xc bn vm' },
  { id: 4, name: 'Čísla', keys: '1234567890', text: '123 456 789 0 12 34 56 78 90' },
  { id: 5, name: 'Věty', keys: 'vše', text: 'Ahoj jak se mas dnes? Venku je hezky.' },
];

export default function Typing() {
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [currentText, setCurrentText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [errors, setErrors] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedLesson && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedLesson]);

  const startLesson = (lesson) => {
    setSelectedLesson(lesson);
    setCurrentText(lesson.text);
    setUserInput('');
    setStartTime(null);
    setEndTime(null);
    setErrors(0);
    setIsComplete(false);
  };

  const handleInput = (e) => {
    const value = e.target.value;
    
    if (!startTime) {
      setStartTime(Date.now());
    }
    
    // Check for errors
    if (value.length > userInput.length) {
      const newChar = value[value.length - 1];
      const expectedChar = currentText[value.length - 1];
      if (newChar !== expectedChar) {
        setErrors(errors + 1);
      }
    }
    
    setUserInput(value);
    
    // Check completion
    if (value === currentText) {
      setEndTime(Date.now());
      setIsComplete(true);
      confetti();
    }
  };

  const getStats = () => {
    if (!startTime || !endTime) return { wpm: 0, accuracy: 100, time: 0 };
    
    const timeInMinutes = (endTime - startTime) / 60000;
    const words = currentText.split(' ').length;
    const wpm = Math.round(words / timeInMinutes);
    const totalChars = currentText.length;
    const accuracy = Math.round(((totalChars - errors) / totalChars) * 100);
    const time = Math.round((endTime - startTime) / 1000);
    
    return { wpm, accuracy, time };
  };

  // Lesson selection
  if (!selectedLesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-violet-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Link to={createPageUrl('Grades?subject=Psaní')}>
            <Button variant="ghost" className="mb-6 text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zpět
            </Button>
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg mb-4">
              <Keyboard className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
              Psaní na klávesnici
            </h1>
            
            <p className="text-slate-600">
              Vyber si lekci a procvičuj psaní všemi deseti
            </p>
          </motion.div>
          
          <div className="grid gap-4">
            {lessons.map((lesson, index) => (
              <motion.button
                key={lesson.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => startLesson(lesson)}
                className="bg-white rounded-2xl p-5 md:p-6 shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-purple-200 text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <span className="text-xl font-bold text-purple-600">{lesson.id}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{lesson.name}</h3>
                    <p className="text-sm text-slate-500">Klávesy: {lesson.keys}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete) {
    const stats = getStats();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-yellow-50 to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full mx-auto mb-6 flex items-center justify-center"
          >
            <Trophy className="w-12 h-12 text-white" />
          </motion.div>
          
          <h2 className="text-3xl font-bold text-slate-800 mb-6">Skvělá práce!</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-purple-50 rounded-2xl p-4">
              <Zap className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">{stats.wpm}</div>
              <div className="text-xs text-slate-500">slov/min</div>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4">
              <Target className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-emerald-600">{stats.accuracy}%</div>
              <div className="text-xs text-slate-500">přesnost</div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4">
              <Timer className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">{stats.time}s</div>
              <div className="text-xs text-slate-500">čas</div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => startLesson(selectedLesson)}
              className="h-14 text-lg rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Zkusit znovu
            </Button>
            
            <Button
              onClick={() => setSelectedLesson(null)}
              variant="outline"
              className="h-14 text-lg rounded-2xl border-2"
            >
              Jiná lekce
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Typing screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-violet-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedLesson(null)}
          className="mb-6 text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Zpět na lekce
        </Button>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{selectedLesson.name}</h1>
          <p className="text-slate-500">Opiš text co nejrychleji a bez chyb</p>
        </motion.div>
        
        {/* Stats bar */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-700">{userInput.length}</div>
            <div className="text-sm text-slate-500">znaků</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{errors}</div>
            <div className="text-sm text-slate-500">chyb</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">
              {currentText.length - userInput.length}
            </div>
            <div className="text-sm text-slate-500">zbývá</div>
          </div>
        </div>
        
        {/* Text display */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-lg mb-6">
          <div className="text-xl md:text-2xl font-mono leading-relaxed select-none">
            {currentText.split('').map((char, index) => {
              let className = 'text-slate-300';
              if (index < userInput.length) {
                className = userInput[index] === char ? 'text-emerald-500' : 'text-red-500 bg-red-100';
              } else if (index === userInput.length) {
                className = 'text-slate-800 bg-yellow-200 animate-pulse';
              }
              return (
                <span key={index} className={className}>
                  {char}
                </span>
              );
            })}
          </div>
        </div>
        
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={handleInput}
          className="w-full bg-white rounded-2xl p-6 text-xl font-mono shadow-md border-2 border-purple-200 focus:border-purple-400 focus:outline-none"
          placeholder="Začni psát zde..."
          autoFocus
        />
        
        {/* Keyboard hint */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Polož prsty na základní řadu: <span className="font-mono font-bold">ASDF JKL;</span>
          </p>
        </div>
      </div>
    </div>
  );
}