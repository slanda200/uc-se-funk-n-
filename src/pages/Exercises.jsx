import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { fetchMyProgress } from '@/lib/progressApi';
import {
  ArrowLeft,
  Star,
  Play,
  CheckCircle2,
  PenTool,
  Link2,
  Grid3X3,
  HelpCircle,
  BookOpen,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProgressFor } from '@/lib/progressStore';

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
  match: 'Spojování',
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

// ✅ Fix: normalizace ID z URL ("" / "null" / "undefined" => null)
const normalizeId = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  return s;
};

// co považujeme za finální test
function isFinalTestExercise(e) {
  return !!e && (e.type === 'test' || e.is_test === true);
}

function pickFinalTestForDifficulty(exercises, diff) {
  const list = Array.isArray(exercises) ? exercises : [];
  const exact = list.find((e) => Number(e?.difficulty) === diff && e?.type === 'test');
  if (exact) return exact;
  const fallback = list.find((e) => Number(e?.difficulty) === diff && e?.is_test === true);
  return fallback || null;
}

function normalizeExerciseRow(row) {
  // Převod DB řádku -> formát, co čekají tvoje UI komponenty (jako exercise.json)
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.id,
    created_at: row.created_at,
    created_by: row.created_by,
    topic_id: row.topic_id ?? null,
    category_id: row.category_id ?? null,
    type: row.type,
    title: row.title,
    instructions: row.instructions ?? null,
    // důležité: payload rozbalit na top-level
    ...payload,
  };
}

export default function Exercises() {
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);

  // ✅ Fix: tady se to nejčastěji rozbíjelo (category="", category="null")
  const topicId = normalizeId(urlParams.get('topic'));
  const categoryId = normalizeId(urlParams.get('category'));

  // supabase user
  const { data: user } = useQuery({
    queryKey: ['sbUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    },
  });

  // načti exercises ze Supabase
  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['sbExercises', topicId, categoryId],
    queryFn: async () => {
      if (!topicId) return [];

      let q = supabase
        .from('exercises')
        .select('id, created_at, created_by, topic_id, category_id, type, title, instructions, payload')
        .eq('topic_id', topicId);

      // ✅ Fix: NE "if(categoryId)" – protože ""/null/"null" rozbíjí filtrování
      if (categoryId !== null) q = q.eq('category_id', categoryId);
      else q = q.is('category_id', null);

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map(normalizeExerciseRow);
    },
    enabled: !!topicId,
  });

  // progress ze Supabase (user_progress)
  const { data: sbProgressRows = [] } = useQuery({
    queryKey: ['userProgress', user?.id],
    queryFn: async () => {
      const rows = await fetchMyProgress();
      return rows || [];
    },
    enabled: !!user?.id,
  });

  const sbProgressMap = React.useMemo(() => {
    const m = new Map();
    for (const r of sbProgressRows || []) {
      m.set(String(r.exercise_id), {
        completed: !!r.completed,
        stars: Number(r.best_stars ?? r.stars ?? 0) || 0,
        score: Number(r.best_score ?? r.score ?? 0) || 0,
      });
    }
    return m;
  }, [sbProgressRows]);

  const useSupabaseProgress = !!user?.id && sbProgressRows.length > 0;

  const getExerciseProgress = (exerciseId) => {
    if (useSupabaseProgress) {
      return sbProgressMap.get(String(exerciseId)) || null;
    }
    const lp = getProgressFor(exerciseId);
    if (!lp) return null;
    return {
      completed: !!lp.completed,
      stars: Number(lp.bestStars ?? lp.stars ?? 0) || 0,
      score: Number(lp.bestScore ?? lp.score ?? 0) || 0,
    };
  };

  const isTestUnlocked = (difficulty) => {
    const difficultyExercises = exercises.filter(
      (e) => Number(e?.difficulty) === difficulty && !isFinalTestExercise(e)
    );
    if (difficultyExercises.length === 0) return false;

    const completed = difficultyExercises.filter((ex) => {
      const p = getExerciseProgress(ex.id);
      return p?.completed;
    });

    return completed.length === difficultyExercises.length;
  };

  const subjectColors = {
    Matematika: {
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      light: 'bg-blue-100',
    },
    Čeština: {
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      light: 'bg-emerald-100',
    },
    Angličtina: {
      gradient: 'from-orange-500 to-amber-600',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      light: 'bg-orange-100',
    },
  };

  // nemáš tu teď topic objekt → nech default
  const colors = subjectColors.Matematika;

  // otevřít finální test
  const openFinalTest = (diff) => {
    const test = pickFinalTestForDifficulty(exercises, diff);
    if (!test?.id) {
      alert('Finální test pro tuto obtížnost nebyl nalezen.');
      return;
    }
    navigate(createPageUrl(`Play?exercise=${test.id}`));
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="mb-4 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zpět
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl md:text-3xl font-bold">Cvičení</h1>
            <p className="text-white/80">
              topic: {topicId} {categoryId !== null ? `• category: ${categoryId}` : ''}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-12 w-12 bg-slate-200 rounded-xl mb-4" />
                <div className="h-5 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : exercises.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <div className={`w-20 h-20 ${colors.light} rounded-3xl mx-auto mb-4 flex items-center justify-center`}>
              <Play className={`w-10 h-10 ${colors.text}`} />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Zatím žádná cvičení</h3>
            <p className="text-slate-500">Pro toto téma ještě nemáme připravená cvičení.</p>
          </motion.div>
        ) : (
          <>
            {[1, 2, 3].map((diff) => {
              const diffExercises = exercises.filter((e) => Number(e?.difficulty) === diff);
              if (diffExercises.length === 0) return null;

              const title =
                diff === 1 ? 'Lehké cvičení' : diff === 2 ? 'Středně těžké cvičení' : 'Těžké cvičení';
              const badge =
                diff === 1
                  ? 'bg-green-100 text-green-700'
                  : diff === 2
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700';

              const finalTest = pickFinalTestForDifficulty(exercises, diff);

              return (
                <div className="mb-8" key={diff}>
                  <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-lg text-sm ${badge}`}>{title}</span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exercises
                      .filter((e) => Number(e?.difficulty) === diff && !isFinalTestExercise(e))
                      .map((exercise, index) => {
                        const p = getExerciseProgress(exercise.id);
                        const Icon = exerciseTypeIcons[exercise.type] || Play;
                        const isCompleted = p?.completed;
                        const stars = p?.stars || 0;

                        return (
                          <motion.div
                            key={exercise.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Link to={createPageUrl(`Play?exercise=${exercise.id}`)}>
                              <div
                                className={`
                                  bg-white rounded-2xl md:rounded-3xl p-5 md:p-6
                                  shadow-md hover:shadow-xl transition-all
                                  border-2 ${isCompleted ? 'border-emerald-200' : 'border-slate-100'}
                                  hover:border-slate-200 relative overflow-hidden
                                `}
                              >
                                {isCompleted && (
                                  <div className="absolute top-3 right-3">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                  </div>
                                )}

                                <div className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center mb-4`}>
                                  <Icon className={`w-6 h-6 ${colors.text}`} />
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 mb-1">{exercise.title}</h3>

                                <p className="text-sm text-slate-500 mb-3">
                                  {exerciseTypeNames[exercise.type] || 'Cvičení'}
                                </p>

                                {exercise.instructions && (
                                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                    {exercise.instructions}
                                  </p>
                                )}

                                <div className="flex items-center gap-1">
                                  {[1, 2, 3].map((s) => (
                                    <Star
                                      key={s}
                                      className={`w-5 h-5 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                    />
                                  ))}
                                  <span className="ml-2 text-sm text-slate-500">{p?.score ?? 0}%</span>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}

                    {finalTest && (() => {
                      const p = getExerciseProgress(finalTest.id);
                      const unlocked = isTestUnlocked(diff);
                      const isCompleted = p?.completed;
                      const stars = p?.stars || 0;

                      return (
                        <motion.div
                          key={finalTest.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => unlocked && openFinalTest(diff)}
                            onKeyDown={(e) => {
                              if (!unlocked) return;
                              if (e.key === 'Enter' || e.key === ' ') openFinalTest(diff);
                            }}
                            className={!unlocked ? 'pointer-events-none' : ''}
                          >
                            <div
                              className={`
                                rounded-2xl md:rounded-3xl p-5 md:p-6
                                shadow-md transition-all
                                border-2 relative overflow-hidden
                                ${
                                  unlocked
                                    ? `bg-gradient-to-br from-yellow-50 to-orange-50 ${
                                        isCompleted ? 'border-yellow-300' : 'border-yellow-200'
                                      } hover:shadow-xl`
                                    : 'bg-slate-100 border-slate-200 opacity-60'
                                }
                              `}
                            >
                              {!unlocked && (
                                <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center backdrop-blur-sm">
                                  <div className="text-center">
                                    <div className="text-3xl mb-2">🔒</div>
                                    <p className="text-sm font-medium text-slate-700">
                                      Dokonči všechna cvičení
                                    </p>
                                  </div>
                                </div>
                              )}

                              {isCompleted && unlocked && (
                                <div className="absolute top-3 right-3">
                                  <CheckCircle2 className="w-6 h-6 text-yellow-500" />
                                </div>
                              )}

                              <div className={`w-12 h-12 rounded-xl ${unlocked ? 'bg-yellow-200' : 'bg-slate-200'} flex items-center justify-center mb-4`}>
                                <Star className={`w-6 h-6 ${unlocked ? 'text-yellow-700' : 'text-slate-400'}`} />
                              </div>

                              <h3 className="text-lg font-bold text-slate-800 mb-1">{finalTest.title}</h3>
                              <p className="text-sm text-slate-500 mb-3">Finální test</p>

                              {finalTest.instructions && (
                                <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                  {finalTest.instructions}
                                </p>
                              )}

                              {unlocked && (
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3].map((s) => (
                                    <Star
                                      key={s}
                                      className={`w-5 h-5 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`}
                                    />
                                  ))}
                                  <span className="ml-2 text-sm text-slate-500">{p?.score ?? 0}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
