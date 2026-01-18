import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Star, Home, RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

import FillExercise from '@/components/exercises/FillExercise';
import MatchExercise from '@/components/exercises/MatchExercise';
import MemoryExercise from '@/components/exercises/MemoryExercise';
import QuizExercise from '@/components/exercises/QuizExercise';
import DecisionExercise from '@/components/exercises/DecisionExercise';
import SortExercise from '@/components/exercises/SortExercise';
import AnalysisExercise from '@/components/exercises/AnalysisExercise';
import ClozeExercise from '@/components/exercises/ClozeExercise';
import TestExercise from '@/components/exercises/TestExercise';
import ListeningExercise from '@/components/exercises/ListeningExercise';
import ImageExercise from '@/components/exercises/ImageExercise';
import { saveProgress } from "@/lib/progressStore";


export default function Play() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const exerciseId = urlParams.get('exercise');
  
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: exercise, isLoading } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: async () => {
      const exercises = await base44.entities.Exercise.filter({ id: exerciseId });
      return exercises[0];
    },
    enabled: !!exerciseId,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', exercise?.topic_id],
    queryFn: async () => {
      const topics = await base44.entities.Topic.filter({ id: exercise.topic_id });
      return topics[0];
    },
    enabled: !!exercise?.topic_id,
  });

  const { data: existingProgress } = useQuery({
    queryKey: ['exerciseProgress', user?.email, exerciseId],
    queryFn: async () => {
      const progress = await base44.entities.UserProgress.filter({ 
        user_email: user?.email, 
        exercise_id: exerciseId 
      });
      return progress[0];
    },
    enabled: !!user?.email && !!exerciseId,
  });

  const saveProgressMutation = useMutation({
    mutationFn: async (data) => {
      if (existingProgress) {
        // Update if better score or first completion
        if (data.score > (existingProgress.score || 0) || !existingProgress.completed) {
          return base44.entities.UserProgress.update(existingProgress.id, {
            completed: true,
            score: Math.max(data.score, existingProgress.score || 0),
            stars: Math.max(data.stars, existingProgress.stars || 0),
            attempts: (existingProgress.attempts || 0) + 1
          });
        }
        return base44.entities.UserProgress.update(existingProgress.id, {
          attempts: (existingProgress.attempts || 0) + 1
        });
      } else {
        return base44.entities.UserProgress.create({
          user_email: user?.email,
          exercise_id: exerciseId,
          completed: true,
          score: data.score,
          stars: data.stars,
          attempts: 1
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProgress'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseProgress'] });
    }
  });

  const handleComplete = (scoreOrData, stars) => {
    const resultData = typeof scoreOrData === 'object'
      ? scoreOrData
      : { score: scoreOrData, stars: stars };

    setResult(resultData);
    setIsComplete(true);

    // ✅ local progress (works without backend/login)
    saveProgress(exerciseId, {
      completed: true,
      score: resultData.score,
      stars: resultData.stars,
    });

    // ✅ backend progress (only if logged in)
    if (user?.email) {
      saveProgressMutation.mutate(resultData);
    }
  };


  const handleRetry = () => {
    setIsComplete(false);
    setResult(null);
  };

  const subjectColors = {
    'Matematika': { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50' },
    'Čeština': { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50' },
    'Angličtina': { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50' },
  };
  
  const colors = subjectColors[topic?.subject] || subjectColors['Matematika'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Načítám cvičení...</div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Cvičení nenalezeno</h2>
          <Link to={createPageUrl('Home')}>
            <Button>Zpět domů</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete && result) {
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
            className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-6 flex items-center justify-center"
          >
            <Trophy className="w-12 h-12 text-white" />
          </motion.div>
          
          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            {result.score >= 90 ? 'Výborně!' : result.score >= 70 ? 'Skvělá práce!' : result.score >= 50 ? 'Dobrá práce!' : 'Nevadí, zkus to znovu!'}
          </h2>
          
          <p className="text-slate-500 mb-6">
            {exercise.title}
          </p>
          
          {/* Stars */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3].map((star, index) => (
              <motion.div
                key={star}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.2 }}
              >
                <Star
                  className={`w-12 h-12 ${
                    star <= result.stars 
                      ? 'text-yellow-400 fill-yellow-400 drop-shadow-lg' 
                      : 'text-slate-200'
                  }`}
                />
              </motion.div>
            ))}
          </div>
          
          <div className="text-4xl font-bold text-slate-800 mb-8">
            {result.score}%
          </div>
          
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleRetry}
              className={`h-14 text-lg rounded-2xl bg-gradient-to-r ${colors.gradient}`}
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Zkusit znovu
            </Button>
            
            <Link to={topic ? createPageUrl(`Exercises?topic=${topic.id}`) : createPageUrl('Home')} className="w-full">
              <Button variant="outline" className="w-full h-14 text-lg rounded-2xl border-2">
                Zpět na cvičení
              </Button>
            </Link>
            
            <Link to={createPageUrl('Home')} className="w-full">
              <Button variant="ghost" className="w-full h-12 rounded-2xl text-slate-500">
                <Home className="w-5 h-5 mr-2" />
                Domů
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // Exercise screen
  const ExerciseComponent = {
    fill: FillExercise,
    match: MatchExercise,
    memory: MemoryExercise,
    quiz: QuizExercise,
    decision: DecisionExercise,
    sort: SortExercise,
    analysis: AnalysisExercise,
    cloze: ClozeExercise,
    test: TestExercise,
    listening: ListeningExercise,
    image: ImageExercise
  }[exercise.type] || FillExercise;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to={topic ? createPageUrl(`Exercises?topic=${topic.id}`) : createPageUrl('Home')}>
              <Button variant="ghost" size="sm" className="text-slate-600">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Zpět
              </Button>
            </Link>
            
            <div className="text-center">
              <h1 className="font-bold text-slate-800">{exercise.title}</h1>
              {topic && (
                <p className="text-xs text-slate-500">{topic.name}</p>
              )}
            </div>
            
            <div className="w-20" />
          </div>
        </div>
      </div>

      {/* Exercise Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {exercise.instructions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 text-center"
          >
            <p className="text-slate-600">{exercise.instructions}</p>
          </motion.div>
        )}
        
        <ExerciseComponent 
          exercise={exercise} 
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}