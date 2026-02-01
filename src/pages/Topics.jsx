import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, BookOpen, Star, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProgressFor } from '@/lib/progressStore';
import { supabase } from '@/lib/supabaseClient';
import { fetchMyProgress } from '@/lib/progressApi';

const subjectColors = {
  Matematika: { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-600', light: 'bg-blue-100' },
  Čeština: { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-600', light: 'bg-emerald-100' },
  Angličtina: { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', text: 'text-orange-600', light: 'bg-orange-100' },
  Psaní: { gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', text: 'text-purple-600', light: 'bg-purple-100' },
};

export default function Topics() {
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get('subject') || 'Matematika';

  const gradeRaw = urlParams.get('grade');
  const grade = Number.isFinite(Number(gradeRaw)) ? parseInt(gradeRaw, 10) : 1;

  const colors = subjectColors[subject] || subjectColors.Matematika;

  // ✅ Supabase user
  const { data: user } = useQuery({
    queryKey: ['sbUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    },
  });

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['topics', subject, grade],
    queryFn: () => base44.entities.Topic.filter({ subject, grade }, 'order'),
  });

  // ✅ všechny exercises (kvůli progresu po tématech)
  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => base44.entities.Exercise.list(),
  });

  // ✅ Supabase progress rows
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
      m.set(String(r.exercise_id), r);
    }
    return m;
  }, [sbProgressRows]);

  const hasSbProgress = !!user?.id && (sbProgressRows?.length || 0) > 0;

  // ✅ jen kategorie pro témata na stránce (rychlejší + správně)
  const topicIds = React.useMemo(() => new Set((topics || []).map(t => String(t.id))), [topics]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categoriesByTopics', subject, grade, topics.length],
    queryFn: async () => {
      const all = await base44.entities.Category.list('order');
      // filtr: kategorie jen pro topics na stránce
      return (all || []).filter(c => topicIds.has(String(c.topic_id)));
    },
    enabled: topicIds.size > 0,
  });

  const getTopicProgress = (topicId) => {
    const topicExercises = exercises.filter(
      (e) => String(e.topic_id) === String(topicId) && !e.is_test
    );

    if (topicExercises.length === 0) {
      return { completed: 0, total: 0, stars: 0, maxStars: 0 };
    }

    // ✅ Supabase-first
    if (hasSbProgress) {
      let completed = 0;
      let stars = 0;

      for (const ex of topicExercises) {
        const row = sbProgressMap.get(String(ex.id));
        if (!row) continue;

        if (row.completed) completed += 1;
        stars += Number(row.best_stars ?? row.stars ?? 0) || 0;
      }

      return {
        completed,
        total: topicExercises.length,
        stars,
        maxStars: topicExercises.length * 3,
      };
    }

    // ✅ localStorage fallback
    let completed = 0;
    let stars = 0;

    for (const ex of topicExercises) {
      const lp = getProgressFor(ex.id);
      if (!lp) continue;

      if (lp.completed) completed += 1;

      const s = lp.bestStars ?? lp.stars;
      if (typeof s === 'number') stars += s;
    }

    return {
      completed,
      total: topicExercises.length,
      stars,
      maxStars: topicExercises.length * 3,
    };
  };

  const topicHasCategories = (topicId) => {
    return categories.some((c) => String(c.topic_id) === String(topicId));
  };

  const getTopicLink = (topicId) => {
    if (topicHasCategories(topicId)) return createPageUrl(`Categories?topic=${topicId}`);
    return createPageUrl(`Exercises?topic=${topicId}`);
  };

  // ✅ Sekce (nadpisy) – pro Češtinu chceme jen 2 sekce
  const SECTION_META = [
    { key: 'grammar', title: 'Gramatika' },
    { key: 'lit_sloh', title: 'Literatura a sloh' },
  ];

  // ✅ Mapování section → naše 2 sekce
  const mapSection = (raw) => {
    const s = raw || 'grammar';
    if (['reading', 'writing', 'literature', 'lit_sloh'].includes(s)) return 'lit_sloh';
    return 'grammar';
  };

  const groupedTopics = React.useMemo(() => {
    return SECTION_META.map((sec) => ({
      ...sec,
      items: topics
        .filter((t) => mapSection(t.section) === sec.key)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }));
  }, [topics]);

  const shouldUseSections = subject === 'Čeština';

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
            {[1, 2, 3].map((i) => (
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
            {(shouldUseSections
              ? groupedTopics.flatMap((group) => {
                  const header = (
                    <motion.div
                      key={`section-${group.key}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-100">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Sekce</div>
                        <div className="text-lg md:text-xl font-extrabold text-slate-800">{group.title}</div>
                      </div>
                    </motion.div>
                  );

                  const cards = group.items.map((topic, index) => {
                    const tp = getTopicProgress(topic.id);
                    const percent = tp.total > 0 ? Math.round((tp.completed / tp.total) * 100) : 0;
                    const hasCats = topicHasCategories(topic.id);

                    return (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06 }}
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
                                    <h3 className="text-lg md:text-xl font-bold text-slate-800">{topic.name}</h3>
                                    {hasCats && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                        kategorie
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {topic.description && (
                                  <p className="text-slate-500 text-sm md:text-base ml-14 mb-3">{topic.description}</p>
                                )}

                                {tp.total > 0 && (
                                  <div className="ml-14">
                                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
                                      <span>
                                        {tp.completed}/{tp.total} cvičení
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        <span>
                                          {tp.stars}/{tp.maxStars}
                                        </span>
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
                              </div>

                              <div className={`p-3 rounded-2xl ${colors.light}`}>
                                <ArrowLeft className={`w-5 h-5 ${colors.text} rotate-180`} />
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  });

                  return [header, ...cards];
                })
              : topics.map((topic, index) => {
                  const tp = getTopicProgress(topic.id);
                  const percent = tp.total > 0 ? Math.round((tp.completed / tp.total) * 100) : 0;
                  const hasCats = topicHasCategories(topic.id);

                  return (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
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
                                  <h3 className="text-lg md:text-xl font-bold text-slate-800">{topic.name}</h3>
                                  {hasCats && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                      kategorie
                                    </span>
                                  )}
                                </div>
                              </div>

                              {topic.description && (
                                <p className="text-slate-500 text-sm md:text-base ml-14 mb-3">{topic.description}</p>
                              )}

                              {tp.total > 0 && (
                                <div className="ml-14">
                                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
                                    <span>
                                      {tp.completed}/{tp.total} cvičení
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                      <span>
                                        {tp.stars}/{tp.maxStars}
                                      </span>
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
                            </div>

                            <div className={`p-3 rounded-2xl ${colors.light}`}>
                              <ArrowLeft className={`w-5 h-5 ${colors.text} rotate-180`} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                }))}
          </div>
        )}
      </div>
    </div>
  );
}
