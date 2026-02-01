import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Calculator, BookOpen, Globe, Keyboard, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProgressFor } from '@/lib/progressStore';
import { supabase } from '@/lib/supabaseClient';
import { fetchMyProgress } from '@/lib/progressApi';

const icons = {
  Calculator: Calculator,
  BookOpen: BookOpen,
  Globe: Globe,
  Keyboard: Keyboard
};

const subjectColors = {
  'Matematika': { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  'Čeština': { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  'Angličtina': { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  'Psaní': { gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' }
};

export default function Grades() {
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get('subject') || 'Matematika';

  const colors = subjectColors[subject] || subjectColors['Matematika'];

  // ✅ Supabase user
  const { data: user } = useQuery({
    queryKey: ['sbUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', subject],
    queryFn: () => base44.entities.Topic.filter({ subject }),
  });

  // ✅ potřebujeme exercises, abychom spočítali progres za třídu
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => base44.entities.Exercise.list(),
  });

  // ✅ Supabase progress rows
  const { data: sbProgressRows = [] } = useQuery({
    queryKey: ['sbUserProgress', user?.id],
    queryFn: async () => {
      const rows = await fetchMyProgress();
      return rows || [];
    },
    enabled: !!user?.id,
  });

  const sbProgressMap = React.useMemo(() => {
    const m = new Map();
    for (const r of sbProgressRows || []) {
      m.set(String(r.exercise_id), r);
    }
    return m;
  }, [sbProgressRows]);

  const hasSbProgress = !!user?.id && (sbProgressRows?.length || 0) > 0;

  // Group topics by grade
  const topicsByGrade = topics.reduce((acc, topic) => {
    if (!acc[topic.grade]) acc[topic.grade] = [];
    acc[topic.grade].push(topic);
    return acc;
  }, {});

  const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Handle typing redirect
  if (subject === 'Psaní') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-violet-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="mb-6 text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zpět
            </Button>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br ${colors.gradient} shadow-lg mb-6`}>
              <Keyboard className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Psaní na klávesnici
            </h1>

            <p className="text-slate-600 mb-8 max-w-xl mx-auto">
              Nauč se psát všemi deseti prsty rychle a bez chyb!
            </p>

            <Link to={createPageUrl('Typing')}>
              <Button className={`h-14 px-8 text-lg rounded-2xl bg-gradient-to-r ${colors.gradient}`}>
                <Keyboard className="w-5 h-5 mr-2" />
                Začít procvičovat
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // ✅ Progres za třídu (souhrn)
  const getGradeProgress = (grade) => {
    const gradeTopics = topicsByGrade[grade] || [];
    if (gradeTopics.length === 0) return { completed: 0, total: 0, stars: 0, maxStars: 0 };

    const topicIds = new Set(gradeTopics.map(t => t.id));
    const gradeExercises = exercises.filter(e => topicIds.has(e.topic_id) && !e.is_test);

    if (gradeExercises.length === 0) return { completed: 0, total: 0, stars: 0, maxStars: 0 };

    // Supabase-first
    if (hasSbProgress) {
      let completed = 0;
      let stars = 0;

      for (const ex of gradeExercises) {
        const row = sbProgressMap.get(String(ex.id));
        if (!row) continue;

        if (row.completed) completed += 1;
        stars += (row.best_stars ?? 0);
      }

      return {
        completed,
        total: gradeExercises.length,
        stars,
        maxStars: gradeExercises.length * 3
      };
    }

    // local fallback
    let completed = 0;
    let stars = 0;

    for (const ex of gradeExercises) {
      const lp = getProgressFor(ex.id);
      if (!lp) continue;

      if (lp.completed) completed += 1;
      const s = (lp.bestStars ?? lp.stars);
      if (typeof s === 'number') stars += s;
    }

    return {
      completed,
      total: gradeExercises.length,
      stars,
      maxStars: gradeExercises.length * 3
    };
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="mb-4 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zpět
            </Button>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              {React.createElement(
                icons[subject === 'Matematika' ? 'Calculator' : subject === 'Čeština' ? 'BookOpen' : 'Globe'] || BookOpen,
                { className: "w-8 h-8 text-white" }
              )}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{subject}</h1>
              <p className="text-white/80">Vyber si svoji třídu</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Grades Grid */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-4">
          {grades.map((grade, index) => {
            const gradeTopics = topicsByGrade[grade] || [];
            const hasTopics = gradeTopics.length > 0;

            const gp = hasTopics ? getGradeProgress(grade) : { completed: 0, total: 0, stars: 0, maxStars: 0 };
            const percent = gp.total > 0 ? Math.round((gp.completed / gp.total) * 100) : 0;

            return (
              <motion.div
                key={grade}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={hasTopics ? createPageUrl(`Topics?subject=${encodeURIComponent(subject)}&grade=${grade}`) : '#'}
                  className={!hasTopics ? 'pointer-events-none' : ''}
                >
                  <div className={`
                    relative rounded-2xl md:rounded-3xl p-4 md:p-6 text-center transition-all
                    ${hasTopics
                      ? `bg-white border-2 ${colors.border} shadow-md hover:shadow-xl hover:scale-105 cursor-pointer`
                      : 'bg-slate-100 border-2 border-slate-200 opacity-50'
                    }
                  `}>
                    <div className={`
                      w-12 h-12 md:w-16 md:h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center
                      ${hasTopics ? `bg-gradient-to-br ${colors.gradient}` : 'bg-slate-300'}
                    `}>
                      <span className="text-xl md:text-2xl font-bold text-white">{grade}</span>
                    </div>

                    <h3 className={`font-bold text-lg md:text-xl ${hasTopics ? colors.text : 'text-slate-400'}`}>
                      {grade}. třída
                    </h3>

                    {hasTopics ? (
                      <>
                        <p className="text-sm text-slate-500 mt-1">
                          {gradeTopics.length} {gradeTopics.length === 1 ? 'téma' : gradeTopics.length < 5 ? 'témata' : 'témat'}
                        </p>

                        {gp.total > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-2">
                              <span>{gp.completed}/{gp.total}</span>
                              <span className="text-slate-300">•</span>
                              <div className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                <span>{gp.stars}/{gp.maxStars}</span>
                              </div>
                            </div>

                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">Brzy</p>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
