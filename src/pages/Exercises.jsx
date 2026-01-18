import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Star, Play, CheckCircle2, PenTool, Link2, Grid3X3, HelpCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProgressFor, getProgressMap } from '@/lib/progressStore';


const exerciseTypeIcons = {
  fill: PenTool,
  match: Link2,
  memory: Grid3X3,
  quiz: HelpCircle,
  decision: HelpCircle,
  sort: Grid3X3,
  analysis: PenTool,
  cloze: PenTool,
  test: Star,
  listening: BookOpen,
  image: BookOpen
};

const exerciseTypeNames = {
  fill: 'Vpisování',
  match: 'Pexeso',
  memory: 'Pexeso',
  quiz: 'Otázky',
  decision: 'Rozhodovačka',
  sort: 'Rozřazovačka',
  analysis: 'Rozbory',
  cloze: 'Doplňování textu',
  test: 'Finální test',
  listening: 'Poslech a psaní',
  image: 'Obrázek a psaní'
};

export default function Exercises() {
  const urlParams = new URLSearchParams(window.location.search);
  const topicId = urlParams.get('topic');
  const categoryId = urlParams.get('category');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: async () => {
      const topics = await base44.entities.Topic.filter({ id: topicId });
      return topics[0];
    },
    enabled: !!topicId,
  });

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises', topicId, categoryId],
    queryFn: () => {
      const filter = categoryId 
        ? { topic_id: topicId, category_id: categoryId }
        : { topic_id: topicId, category_id: null };
      return base44.entities.Exercise.filter(filter);
    },
    enabled: !!topicId,
  });

  const { data: category } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const categories = await base44.entities.Category.filter({ id: categoryId });
      return categories[0];
    },
    enabled: !!categoryId,
  });

  // Base44 progress (only if logged in)
  const { data: progress = [] } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  // Local progress (always available)
  // NOTE: This reads from localStorage; it will update after navigation/reload.
  // If you want live updates without reload, we can add a tiny event later.
  const localProgressMap = React.useMemo(() => {
    try {
      return getProgressMap();
    } catch {
      return {};
    }
  }, []);

  const getExerciseProgress = (exerciseId) => {
    // 1) pokud je přihlášení, ber backend
    if (user?.email) {
      return progress.find(p => p.exercise_id === exerciseId) || null;
    }

    // 2) jinak ber localStorage
    const lp = getProgressFor(exerciseId);
    if (!lp) return null;

    return {
      completed: !!lp.completed,
      score: lp.bestScore ?? lp.score ?? 0,
      stars: lp.bestStars ?? lp.stars ?? 0,
    };
  };



  const isTestUnlocked = (difficulty) => {
    const difficultyExercises = exercises.filter(e => e.difficulty === difficulty && !e.is_test);
    if (difficultyExercises.length === 0) return false;
    
    const completed = difficultyExercises.filter(ex => {
      const prog = getExerciseProgress(ex.id);
      return prog?.completed;
    });
    
    return completed.length === difficultyExercises.length;
  };

  const subjectColors = {
    'Matematika': { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-600', light: 'bg-blue-100' },
    'Čeština': { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-600', light: 'bg-emerald-100' },
    'Angličtina': { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', text: 'text-orange-600', light: 'bg-orange-100' },
  };
  
  const colors = subjectColors[topic?.subject] || subjectColors['Matematika'];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={categoryId ? createPageUrl(`Categories?topic=${topicId}`) : (topic ? createPageUrl(`Topics?subject=${encodeURIComponent(topic.subject)}&grade=${topic.grade}`) : createPageUrl('Home'))}>
            <Button variant="ghost" className="mb-4 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" />
              {categoryId ? 'Zpět na kategorie' : 'Zpět na témata'}
            </Button>
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold">
              {category ? category.name : (topic?.name || 'Cvičení')}
            </h1>
            {topic && (
              <p className="text-white/80">
                {topic.subject} • {topic.grade}. třída
                {category && ` • ${topic.name}`}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Exercises Grid */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Topic Explanation */}
        {topic?.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-6 border-2 border-blue-200"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center flex-shrink-0`}>
                <BookOpen className={`w-6 h-6 ${colors.text}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  📚 Vysvětlivka
                </h3>
                <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                  {topic.explanation}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-12 w-12 bg-slate-200 rounded-xl mb-4" />
                <div className="h-5 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : exercises.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className={`w-20 h-20 ${colors.light} rounded-3xl mx-auto mb-4 flex items-center justify-center`}>
              <Play className={`w-10 h-10 ${colors.text}`} />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">
              Zatím žádná cvičení
            </h3>
            <p className="text-slate-500">
              Pro toto téma ještě nemáme připravená cvičení.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Easy Exercises */}
            {exercises.filter(e => e.difficulty === 1).length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm">Lehké cvičení</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exercises.filter(e => e.difficulty === 1 && !e.is_test).map((exercise, index) => {
                    const exerciseProgress = getExerciseProgress(exercise.id);
                    const Icon = exerciseTypeIcons[exercise.type] || Play;
                    const isCompleted = exerciseProgress?.completed;
                    const stars = exerciseProgress?.stars || 0;
                    
                    return (
                      <motion.div
                        key={exercise.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link to={createPageUrl(`Play?exercise=${exercise.id}`)}>
                          <div className={`
                            bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 
                            shadow-md hover:shadow-xl transition-all 
                            border-2 ${isCompleted ? 'border-emerald-200' : 'border-slate-100'} 
                            hover:border-slate-200 relative overflow-hidden
                          `}>
                            {isCompleted && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                              </div>
                            )}
                            
                            <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center mb-4`}>
                              <Icon className={`w-6 h-6 ${colors.text}`} />
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                              {exercise.title}
                            </h3>
                            
                            <p className="text-sm text-slate-500 mb-3">
                              {exerciseTypeNames[exercise.type] || 'Cvičení'}
                            </p>
                            
                            {exercise.instructions && (
                              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                {exercise.instructions}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-1">
                              {[1, 2, 3].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-5 h-5 ${
                                    star <= stars 
                                      ? 'text-yellow-400 fill-yellow-400' 
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                              {exerciseProgress?.score !== undefined && (
                                <span className="ml-2 text-sm text-slate-500">
                                  {exerciseProgress.score}%
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                  
                  {/* Test for difficulty 1 */}
                  {exercises.filter(e => e.difficulty === 1 && e.is_test).map((exercise) => {
                    const exerciseProgress = getExerciseProgress(exercise.id);
                    const isUnlocked = isTestUnlocked(1);
                    const Icon = exerciseTypeIcons[exercise.type] || Star;
                    const isCompleted = exerciseProgress?.completed;
                    const stars = exerciseProgress?.stars || 0;
                    
                    return (
                      <motion.div
                        key={exercise.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <Link to={isUnlocked ? createPageUrl(`Play?exercise=${exercise.id}`) : '#'} className={!isUnlocked ? 'pointer-events-none' : ''}>
                          <div className={`
                            rounded-2xl md:rounded-3xl p-5 md:p-6 
                            shadow-md transition-all 
                            border-2 relative overflow-hidden
                            ${isUnlocked 
                              ? `bg-gradient-to-br from-yellow-50 to-orange-50 ${isCompleted ? 'border-yellow-300' : 'border-yellow-200'} hover:shadow-xl` 
                              : 'bg-slate-100 border-slate-200 opacity-60'
                            }
                          `}>
                            {!isUnlocked && (
                              <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center backdrop-blur-sm">
                                <div className="text-center">
                                  <div className="text-3xl mb-2">🔒</div>
                                  <p className="text-sm font-medium text-slate-700">Dokonči všechna cvičení</p>
                                </div>
                              </div>
                            )}
                            
                            {isCompleted && isUnlocked && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle2 className="w-6 h-6 text-yellow-500" />
                              </div>
                            )}
                            
                            <div className={`w-12 h-12 rounded-xl ${isUnlocked ? 'bg-yellow-200' : 'bg-slate-200'} flex items-center justify-center mb-4`}>
                              <Icon className={`w-6 h-6 ${isUnlocked ? 'text-yellow-700' : 'text-slate-400'}`} />
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                              {exercise.title}
                            </h3>
                            
                            <p className="text-sm text-slate-500 mb-3">
                              {exerciseTypeNames[exercise.type] || 'Cvičení'}
                            </p>
                            
                            {exercise.instructions && (
                              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                {exercise.instructions}
                              </p>
                            )}
                            
                            {isUnlocked && (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-5 h-5 ${
                                      star <= stars 
                                        ? 'text-yellow-400 fill-yellow-400' 
                                        : 'text-slate-200'
                                    }`}
                                  />
                                ))}
                                {exerciseProgress?.score !== undefined && (
                                  <span className="ml-2 text-sm text-slate-500">
                                    {exerciseProgress.score}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Medium Exercises */}
            {exercises.filter(e => e.difficulty === 2).length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm">Středně těžké cvičení</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exercises.filter(e => e.difficulty === 2 && !e.is_test).map((exercise, index) => {
                    const exerciseProgress = getExerciseProgress(exercise.id);
                    const Icon = exerciseTypeIcons[exercise.type] || Play;
                    const isCompleted = exerciseProgress?.completed;
                    const stars = exerciseProgress?.stars || 0;
                    
                    return (
                      <motion.div
                        key={exercise.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link to={createPageUrl(`Play?exercise=${exercise.id}`)}>
                          <div className={`
                            bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 
                            shadow-md hover:shadow-xl transition-all 
                            border-2 ${isCompleted ? 'border-emerald-200' : 'border-slate-100'} 
                            hover:border-slate-200 relative overflow-hidden
                          `}>
                            {isCompleted && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                              </div>
                            )}
                            
                            <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center mb-4`}>
                              <Icon className={`w-6 h-6 ${colors.text}`} />
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                              {exercise.title}
                            </h3>
                            
                            <p className="text-sm text-slate-500 mb-3">
                              {exerciseTypeNames[exercise.type] || 'Cvičení'}
                            </p>
                            
                            {exercise.instructions && (
                              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                {exercise.instructions}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-1">
                              {[1, 2, 3].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-5 h-5 ${
                                    star <= stars 
                                      ? 'text-yellow-400 fill-yellow-400' 
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                              {exerciseProgress?.score !== undefined && (
                                <span className="ml-2 text-sm text-slate-500">
                                  {exerciseProgress.score}%
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                  
                  {/* Test for difficulty 2 */}
                  {exercises.filter(e => e.difficulty === 2 && e.is_test).map((exercise) => {
                    const exerciseProgress = getExerciseProgress(exercise.id);
                    const isUnlocked = isTestUnlocked(2);
                    const Icon = exerciseTypeIcons[exercise.type] || Star;
                    const isCompleted = exerciseProgress?.completed;
                    const stars = exerciseProgress?.stars || 0;
                    
                    return (
                      <motion.div
                        key={exercise.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <Link to={isUnlocked ? createPageUrl(`Play?exercise=${exercise.id}`) : '#'} className={!isUnlocked ? 'pointer-events-none' : ''}>
                          <div className={`
                            rounded-2xl md:rounded-3xl p-5 md:p-6 
                            shadow-md transition-all 
                            border-2 relative overflow-hidden
                            ${isUnlocked 
                              ? `bg-gradient-to-br from-yellow-50 to-orange-50 ${isCompleted ? 'border-yellow-300' : 'border-yellow-200'} hover:shadow-xl` 
                              : 'bg-slate-100 border-slate-200 opacity-60'
                            }
                          `}>
                            {!isUnlocked && (
                              <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center backdrop-blur-sm">
                                <div className="text-center">
                                  <div className="text-3xl mb-2">🔒</div>
                                  <p className="text-sm font-medium text-slate-700">Dokonči všechna cvičení</p>
                                </div>
                              </div>
                            )}
                            
                            {isCompleted && isUnlocked && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle2 className="w-6 h-6 text-yellow-500" />
                              </div>
                            )}
                            
                            <div className={`w-12 h-12 rounded-xl ${isUnlocked ? 'bg-yellow-200' : 'bg-slate-200'} flex items-center justify-center mb-4`}>
                              <Icon className={`w-6 h-6 ${isUnlocked ? 'text-yellow-700' : 'text-slate-400'}`} />
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                              {exercise.title}
                            </h3>
                            
                            <p className="text-sm text-slate-500 mb-3">
                              {exerciseTypeNames[exercise.type] || 'Cvičení'}
                            </p>
                            
                            {exercise.instructions && (
                              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                {exercise.instructions}
                              </p>
                            )}
                            
                            {isUnlocked && (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-5 h-5 ${
                                      star <= stars 
                                        ? 'text-yellow-400 fill-yellow-400' 
                                        : 'text-slate-200'
                                    }`}
                                  />
                                ))}
                                {exerciseProgress?.score !== undefined && (
                                  <span className="ml-2 text-sm text-slate-500">
                                    {exerciseProgress.score}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hard Exercises */}
            {exercises.filter(e => e.difficulty === 3).length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm">Těžké cvičení</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exercises.filter(e => e.difficulty === 3 && !e.is_test).map((exercise, index) => {
                    const exerciseProgress = getExerciseProgress(exercise.id);
                    const Icon = exerciseTypeIcons[exercise.type] || Play;
                    const isCompleted = exerciseProgress?.completed;
                    const stars = exerciseProgress?.stars || 0;
                    
                    return (
                      <motion.div
                        key={exercise.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link to={createPageUrl(`Play?exercise=${exercise.id}`)}>
                          <div className={`
                            bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 
                            shadow-md hover:shadow-xl transition-all 
                            border-2 ${isCompleted ? 'border-emerald-200' : 'border-slate-100'} 
                            hover:border-slate-200 relative overflow-hidden
                          `}>
                            {isCompleted && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                              </div>
                            )}
                            
                            <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center mb-4`}>
                              <Icon className={`w-6 h-6 ${colors.text}`} />
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                              {exercise.title}
                            </h3>
                            
                            <p className="text-sm text-slate-500 mb-3">
                              {exerciseTypeNames[exercise.type] || 'Cvičení'}
                            </p>
                            
                            {exercise.instructions && (
                              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                {exercise.instructions}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-1">
                              {[1, 2, 3].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-5 h-5 ${
                                    star <= stars 
                                      ? 'text-yellow-400 fill-yellow-400' 
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                              {exerciseProgress?.score !== undefined && (
                                <span className="ml-2 text-sm text-slate-500">
                                  {exerciseProgress.score}%
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                  
                  {/* Test for difficulty 3 */}
                  {exercises.filter(e => e.difficulty === 3 && e.is_test).map((exercise) => {
                    const exerciseProgress = getExerciseProgress(exercise.id);
                    const isUnlocked = isTestUnlocked(3);
                    const Icon = exerciseTypeIcons[exercise.type] || Star;
                    const isCompleted = exerciseProgress?.completed;
                    const stars = exerciseProgress?.stars || 0;
                    
                    return (
                      <motion.div
                        key={exercise.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <Link to={isUnlocked ? createPageUrl(`Play?exercise=${exercise.id}`) : '#'} className={!isUnlocked ? 'pointer-events-none' : ''}>
                          <div className={`
                            rounded-2xl md:rounded-3xl p-5 md:p-6 
                            shadow-md transition-all 
                            border-2 relative overflow-hidden
                            ${isUnlocked 
                              ? `bg-gradient-to-br from-yellow-50 to-orange-50 ${isCompleted ? 'border-yellow-300' : 'border-yellow-200'} hover:shadow-xl` 
                              : 'bg-slate-100 border-slate-200 opacity-60'
                            }
                          `}>
                            {!isUnlocked && (
                              <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center backdrop-blur-sm">
                                <div className="text-center">
                                  <div className="text-3xl mb-2">🔒</div>
                                  <p className="text-sm font-medium text-slate-700">Dokonči všechna cvičení</p>
                                </div>
                              </div>
                            )}
                            
                            {isCompleted && isUnlocked && (
                              <div className="absolute top-3 right-3">
                                <CheckCircle2 className="w-6 h-6 text-yellow-500" />
                              </div>
                            )}
                            
                            <div className={`w-12 h-12 rounded-xl ${isUnlocked ? 'bg-yellow-200' : 'bg-slate-200'} flex items-center justify-center mb-4`}>
                              <Icon className={`w-6 h-6 ${isUnlocked ? 'text-yellow-700' : 'text-slate-400'}`} />
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                              {exercise.title}
                            </h3>
                            
                            <p className="text-sm text-slate-500 mb-3">
                              {exerciseTypeNames[exercise.type] || 'Cvičení'}
                            </p>
                            
                            {exercise.instructions && (
                              <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                {exercise.instructions}
                              </p>
                            )}
                            
                            {isUnlocked && (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-5 h-5 ${
                                      star <= stars 
                                        ? 'text-yellow-400 fill-yellow-400' 
                                        : 'text-slate-200'
                                    }`}
                                  />
                                ))}
                                {exerciseProgress?.score !== undefined && (
                                  <span className="ml-2 text-sm text-slate-500">
                                    {exerciseProgress.score}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}