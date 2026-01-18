import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, BookOpen, Star, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProgressFor } from '@/lib/progressStore';

const subjectColors = {
  'Matematika': { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-600', light: 'bg-blue-100' },
  'Čeština': { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-600', light: 'bg-emerald-100' },
  'Angličtina': { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', text: 'text-orange-600', light: 'bg-orange-100' },
  'Psaní': { gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', text: 'text-purple-600', light: 'bg-purple-100' }
};

export default function Topics() {
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get('subject') || 'Matematika';
  const grade = parseInt(urlParams.get('grade') || '1', 10);

  const colors = subjectColors[subject] || subjectColors['Matematika'];

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['topics', subject, grade],
    queryFn: () => base44.entities.Topic.filter({ subject, grade }, 'order'),
  });

  // všechny exercises (kvůli progresu po tématech)
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => base44.entities.Exercise.list(),
  });

  // všechny kategorie pro daný subject+grade (abychom poznali, co má kategorie)
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', subject, grade],
    queryFn: async () => {
      // vezmeme kategorie a pak je spárujeme s tématy přes topic_id
      return base44.entities.Category.list('order');
    }
  });

  // backend progress (pokud existuje user)
  const { data: progress = [] } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const getTopicProgress = (topicId) => {
    const topicExercises = exercises.filter(e => e.topic_id === topicId && !e.is_test);
    if (topicExercises.length === 0) return { completed: 0, total: 0, stars: 0, maxStars: 0 };

    // ✅ backend (pokud je user)
    if (user?.email) {
      const completedExercises = topicExercises.filter(e =>
        progress.some(p => p.exercise_id === e.id && p.completed)
      );

      const totalStars = progress
        .filter(p => topicExercises.some(e => e.id === p.exercise_id))
        .reduce((sum, p) => sum + (p.stars || 0), 0);

      return {
        completed: completedExercises.length,
        total: topicExercises.length,
        stars: totalStars,
        maxStars: topicExercises.length * 3
      };
    }

    // ✅ localStorage (když user není)
    let completed = 0;
    let stars = 0;

    for (const ex of topicExercises) {
      const lp = getProgressFor(ex.id);
      if (!lp) continue;

      if (lp.completed) completed += 1;

      const s = (lp.bestStars ?? lp.stars);
      if (typeof s === 'number') stars += s;
    }

    return {
      completed,
      total: topicExercises.length,
      stars,
      maxStars: topicExercises.length * 3
    };
  };

  const topicHasCategories = (topicId) => {
    // jestli existuje aspoň 1 kategorie s topic_id === topicId
    return categories.some(c => c.topic_id === topicId);
  };

  const getTopicLink = (topicId) => {
    if (topicHasCategories(topicId)) return createPageUrl(`Categories?topic=${topicId}`);
    return createPageUrl(`Exercises?topic=${topicId}`);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={createPageUrl(`Grades?subject=${encodeURIComponent(subject)}`)}>
            <Button variant="ghost" className="mb-4 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zpět na třídy
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-bold">{subject}</h1>
            <p className="text-white/80 text-lg">{grade}. třída</p>
          </motion.div>
        </div>
      </div>

      {/* Topics List */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : topics.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <div className={`w-20 h-20 ${colors.light} rounded-3xl mx-auto mb-4 flex items-center justify-center`}>
              <BookOpen className={`w-10 h-10 ${colors.text}`} />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Zatím žádná témata</h3>
            <p className="text-slate-500">Pro tuto třídu ještě nemáme připravená témata.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {topics.map((topic, index) => {
              const topicProgress = getTopicProgress(topic.id);
              const progressPercent = topicProgress.total > 0
                ? Math.round((topicProgress.completed / topicProgress.total) * 100)
                : 0;

              const hasCats = topicHasCategories(topic.id);

              return (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={getTopicLink(topic.id)}>
                    <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-md hover:shadow-xl transition-all border border-slate-100 hover:border-slate-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-10 h-10 rounded-xl ${colors.light} flex items-center justify-center`}>
                              <Play className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg md:text-xl font-bold text-slate-800">
                                {topic.name}
                              </h3>
                              {hasCats && (
                                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                  kategorie
                                </span>
                              )}
                            </div>
                          </div>

                          {topic.description && (
                            <p className="text-slate-500 text-sm md:text-base ml-14 mb-3">
                              {topic.description}
                            </p>
                          )}

                          {topicProgress.total > 0 && (
                            <div className="ml-14">
                              <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
                                <span>{topicProgress.completed}/{topicProgress.total} cvičení</span>
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                  <span>{topicProgress.stars}/{topicProgress.maxStars}</span>
                                </div>
                              </div>

                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className={`p-3 rounded-2xl ${colors.light}`}>
                          <ArrowLeft className={`w-5 h-5 ${colors.text} rotate-180`} />
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
