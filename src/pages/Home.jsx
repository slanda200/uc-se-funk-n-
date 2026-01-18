import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SubjectCard from '@/components/home/SubjectCard';
import StatsCard from '@/components/home/StatsCard';
import { Sparkles, GraduationCap } from 'lucide-react';
import { getProgressMap } from '@/lib/progressStore';

export default function Home() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('order'),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  // Local progress (works without login/backend)
  const localProgressArray = React.useMemo(() => {
    try {
      const map = getProgressMap();
      return Object.values(map || {}).map((p) => ({
        completed: !!p.completed,
        stars: p.bestStars ?? p.stars ?? 0,
        score: p.bestScore ?? p.score ?? 0,
      }));
    } catch {
      return [];
    }
  }, []);

  const effectiveProgress =
    (user?.email && progress.length > 0) ? progress : localProgressArray;

  const shouldShowStats = effectiveProgress.length > 0;

  // Default subjects if none exist
  const displaySubjects = subjects.length > 0 ? subjects : [
    { name: 'Matematika', icon: 'Calculator', order: 1 },
    { name: 'Čeština', icon: 'BookOpen', order: 2 },
    { name: 'Angličtina', icon: 'Globe', order: 3 },
    { name: 'Psaní', icon: 'Keyboard', order: 4 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-yellow-300/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-emerald-300/20 to-transparent rounded-full blur-3xl" />

        <div className="relative px-4 py-8 md:py-12">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm mb-4">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-slate-600">
                  Učení hrou
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                Uč se snadně
              </h1>

              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
                {user?.full_name ? (
                  <>Ahoj, <span className="font-semibold text-slate-800">{user.full_name}</span>! Připraven se učit?</>
                ) : (
                  'Procvičuj látku ze školy zábavnou formou'
                )}
              </p>
            </motion.div>

            {/* Stats (backend OR localStorage) */}
            {shouldShowStats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8"
              >
                <StatsCard progress={effectiveProgress} />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <GraduationCap className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">Vyber si předmět</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {displaySubjects.map((subject, index) => (
              <SubjectCard key={subject.name} subject={subject} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
