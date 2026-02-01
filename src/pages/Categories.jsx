import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';
import { fetchMyProgress } from '@/lib/progressApi';
import { ArrowLeft, BookOpen, Star, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProgressFor } from '@/lib/progressStore';

export default function Categories() {
  const urlParams = new URLSearchParams(window.location.search);
  const topicId = urlParams.get('topic');

  /**
   * ✅ Supabase user (stejně jako Home.jsx)
   */
  const { data: user } = useQuery({
    queryKey: ['sbUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    },
  });

  /**
   * ✅ Topic / Categories / Exercises necháme na Base44 (seed data)
   */
  const { data: topic } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: async () => {
      const topics = await base44.entities.Topic.filter({ id: topicId });
      return topics[0];
    },
    enabled: !!topicId,
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', topicId],
    queryFn: () => base44.entities.Category.filter({ topic_id: topicId }, 'order'),
    enabled: !!topicId,
  });

  const { data: allExercises = [] } = useQuery({
    queryKey: ['exercises', topicId],
    queryFn: () => base44.entities.Exercise.filter({ topic_id: topicId }),
    enabled: !!topicId,
  });

  /**
   * ✅ Progress ze Supabase (stejně jako Home.jsx)
   */
  const { data: sbProgressRows = [] } = useQuery({
    queryKey: ['userProgress', user?.id],
    queryFn: async () => {
      const rows = await fetchMyProgress(); // bere usera uvnitř přes supabase.auth.getUser()
      return rows || [];
    },
    enabled: !!user?.id,
  });

  /**
   * ✅ Uděláme mapu progressu: exercise_id -> {completed, stars, score}
   * (normalizace stejně jako Home.jsx)
   */
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

  /**
   * ✅ helper: progress pro exercise (Supabase prefer, jinak local)
   */
  const getExerciseProgress = (exerciseId) => {
    if (user?.id && sbProgressMap.size > 0) {
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

  /**
   * ✅ Kategorie progress = součet přes cvičení v kategorii
   */
  const getCategoryProgress = (categoryId) => {
    const categoryExercises = allExercises.filter(
      (e) => String(e.category_id) === String(categoryId) && !e.is_test
    );

    if (categoryExercises.length === 0) {
      return { completed: 0, total: 0, stars: 0, maxStars: 0 };
    }

    let completed = 0;
    let stars = 0;

    for (const ex of categoryExercises) {
      const p = getExerciseProgress(ex.id);
      if (!p) continue;

      if (p.completed) completed += 1;
      stars += p.stars || 0;
    }

    return {
      completed,
      total: categoryExercises.length,
      stars,
      maxStars: categoryExercises.length * 3,
    };
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

  const colors = subjectColors[topic?.subject] || subjectColors.Matematika;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            to={
              topic
                ? createPageUrl(
                    `Topics?subject=${encodeURIComponent(topic.subject)}&grade=${topic.grade}`
                  )
                : createPageUrl('Home')
            }
          >
            <Button
              variant="ghost"
              className="mb-4 text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zpět na témata
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl md:text-3xl font-bold">{topic?.name || 'Kategorie'}</h1>
            {topic && (
              <p className="text-white/80">
                {topic.subject} • {topic.grade}. třída
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Vyber kategorii</h2>

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
        ) : categories.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <div
              className={`w-20 h-20 ${colors.light} rounded-3xl mx-auto mb-4 flex items-center justify-center`}
            >
              <BookOpen className={`w-10 h-10 ${colors.text}`} />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Zatím žádné kategorie</h3>
            <p className="text-slate-500">Pro toto téma ještě nemáme připravené kategorie.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((category, index) => {
              const categoryProgress = getCategoryProgress(category.id);
              const isCompleted =
                categoryProgress.total > 0 &&
                categoryProgress.completed === categoryProgress.total;

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Link to={createPageUrl(`Exercises?topic=${topicId}&category=${category.id}`)}>
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

                      <div
                        className={`w-12 h-12 rounded-xl ${colors.light} flex items-center justify-center mb-4`}
                      >
                        <BookOpen className={`w-6 h-6 ${colors.text}`} />
                      </div>

                      <h3 className="text-lg font-bold text-slate-800 mb-1">{category.name}</h3>

                      {category.description && (
                        <p className="text-sm text-slate-500 mb-3">{category.description}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                          {categoryProgress.completed}/{categoryProgress.total} splněno
                        </div>

                        <div className="flex items-center gap-1">
                          <Star
                            className={`w-4 h-4 ${
                              categoryProgress.stars > 0
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-slate-200'
                            }`}
                          />
                          <span className="text-sm font-medium text-slate-600">
                            {categoryProgress.stars}/{categoryProgress.maxStars}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
