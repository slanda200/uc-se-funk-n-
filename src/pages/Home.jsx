import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SubjectCard from '@/components/home/SubjectCard';
import StatsCard from '@/components/home/StatsCard';
import { Sparkles, GraduationCap, Flame, Trophy, Library } from 'lucide-react';
import { getProgressMap } from '@/lib/progressStore';
import { supabase } from '@/lib/supabaseClient';
import { fetchMyProgress } from '@/lib/progressApi';

// pokud to máš jinde, uprav si cestu
import UsernameModal from '@/components/auth/UsernameModal';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

export default function Home() {
  /**
   * ✅ Supabase user
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
   * ✅ Profile row (username) – aby neblikalo
   */
  const {
    data: profileRow,
    refetch: refetchProfile,
    isLoading: profileLoading,
    isFetched: profileFetched,
  } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const hasUsername = React.useMemo(() => {
    return !!profileRow?.username && String(profileRow.username).trim().length > 0;
  }, [profileRow?.username]);

  const shouldAskUsername = !!user?.id && profileFetched && !profileLoading && !hasUsername;
  const [needUsername, setNeedUsername] = React.useState(false);

  React.useEffect(() => {
    if (!user?.id) {
      setNeedUsername(false);
      return;
    }
    setNeedUsername(shouldAskUsername);
  }, [user?.id, shouldAskUsername]);

  /**
   * ✅ Subjects z Base44
   */
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('order'),
  });

  /**
   * ✅ Progress ze Supabase
   */
  const { data: sbProgressRows = [] } = useQuery({
    queryKey: ['userProgress', user?.id],
    queryFn: async () => {
      const rows = await fetchMyProgress();
      return rows || [];
    },
    enabled: !!user?.id,
  });

  /**
   * ✅ Aktuální seznam cvičení ze Supabase (aby se statistiky počítaly jen z existujících cvičení)
   */
  const { data: sbExercises = [] } = useQuery({
    queryKey: ['sbExercisesForStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, type, payload');

      if (error) throw error;

      return (data || []).map((r) => ({
        id: String(r.id),
        is_test: !!(r?.payload?.is_test) || r.type === 'test',
      }));
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const sbExerciseIdSet = React.useMemo(() => new Set((sbExercises || []).map((e) => String(e.id))), [sbExercises]);
  const sbIsTestById = React.useMemo(() => {
    const m = new Map();
    for (const e of sbExercises || []) m.set(String(e.id), !!e.is_test);
    return m;
  }, [sbExercises]);

  /**
   * ✅ Daily streak ze Supabase
   */
  const { data: streakRow } = useQuery({
    queryKey: ['streak', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('streak_count, longest_streak, last_active_date')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return null;
      return data || null;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const streakCount = Number(streakRow?.streak_count ?? 0) || 0;
  const longestStreak = Number(streakRow?.longest_streak ?? 0) || 0;
  const lastActiveDate = streakRow?.last_active_date || null;

  /**
   * ✅ Local progress (fallback)
   */
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

  /**
   * ✅ Převod Supabase řádků do tvaru pro StatsCard (jen existující cvičení + bez testů)
   */
  const sbProgressArray = React.useMemo(() => {
    const allowed = sbExerciseIdSet;
    return (sbProgressRows || [])
      .filter((r) => {
        const exId = String(r.exercise_id);
        if (allowed.size > 0 && !allowed.has(exId)) return false;
        if (sbIsTestById.get(exId)) return false;
        return true;
      })
      .map((r) => ({
        completed: !!r.completed,
        stars: r.best_stars ?? 0,
        score: r.best_score ?? 0,
      }));
  }, [sbProgressRows, sbExerciseIdSet, sbIsTestById]);

  /**
   * ✅ Preferuj Supabase progress, pokud existuje
   */
  const effectiveProgress =
    user?.id && sbProgressArray.length > 0 ? sbProgressArray : localProgressArray;

  const shouldShowStats = effectiveProgress.length > 0;

  /**
   * ✅ Fallback (když v DB ještě nejsou Subjects)
   */
  const defaultItems = [
    { name: 'Čeština', icon: 'BookOpen', order: 1, group: 'subject' },
    { name: 'Angličtina', icon: 'Globe', order: 2, group: 'subject' },
    { name: 'Matematika', icon: 'Calculator', order: 3, group: 'subject' },
    { name: 'Psaní', icon: 'Keyboard', order: 4, group: 'subject' },

    { name: 'Přijímačky', icon: 'PenLine', order: 101, group: 'exam' },
    { name: 'Maturita', icon: 'Trophy', order: 102, group: 'exam' },
  ];

  const displayAll = (subjects?.length > 0 ? subjects : defaultItems).map((s) => ({
    ...s,
    group: s.group || 'subject',
  }));

  const displaySubjects = displayAll
    .filter((s) => s.group === 'subject')
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const displayExamTracks = displayAll
    .filter((s) => s.group === 'exam')
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <UsernameModal
        open={needUsername}
        userId={user?.id}
        onClose={async () => {
          setNeedUsername(false);
          await refetchProfile();
        }}
      />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-yellow-300/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-emerald-300/20 to-transparent rounded-full blur-3xl" />

        <div className="relative px-4 py-8 md:py-12">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm mb-4">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-slate-600">Učení hrou</span>
              </div>

              <div className="relative mb-3 flex items-center justify-center">
                <h1 className="relative text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                  Uč se snadně
                </h1>
              </div>

              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
                {user?.email ? <>Ahoj! Připraven se učit?</> : 'Procvičuj látku ze školy zábavnou formou'}
              </p>
            </motion.div>

            {/* ✅ WRAPPER PRO MASKOTA V POZADÍ (za streak i za stats) */}
            <div className="relative isolate min-h-[220px] md:min-h-0">
              <img
                src="/postava.png"
                alt="Maskot"
                className="absolute left-[82%] -translate-x-1/2 bottom-[-8px] h-[160px] sm:left-[78%] sm:bottom-[-18px] sm:h-[220px] md:bottom-[-38px] md:h-[270px] lg:bottom-[-52px] lg:h-[300px] w-auto object-contain pointer-events-none select-none z-0"
              />

              <div className="relative z-10">
                {/* Streak */}
                {!!user?.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="mb-6"
                  >
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                            <Flame className="w-5 h-5 text-orange-600" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm text-slate-600">Daily streak</div>
                            <div className="text-lg font-bold text-slate-800">
                              {streakCount} dní
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-700">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-medium">Rekord: {longestStreak}</span>
                          </div>
                          {lastActiveDate && (
                            <div className="text-xs text-slate-500">
                              Poslední aktivita: {lastActiveDate}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Stats */}
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

                {!user?.id && !shouldShowStats && <div className="h-14 md:h-0" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {/* ✅ větší mezera mezi hero a bílou částí */}
      <div className="px-4 pb-12 pt-10">
        <div className="max-w-4xl mx-auto">
          {/* Předměty + Knihovna button */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-slate-700" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-800">Vyber si předmět</h2>
            </div>

            {/* ✅ Viditelný button napravo */}
            <Link to={createPageUrl("Library")}>
              <Button className="h-11 px-5 rounded-2xl font-bold shadow-sm">
                <Library className="w-5 h-5 mr-2" />
                Knihovna učiva
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {displaySubjects.map((subject, index) => (
              <SubjectCard key={subject.id || subject.name} subject={subject} index={index} />
            ))}
          </div>

          {/* Zkoušky */}
          <div className="flex items-center gap-3 mt-10 mb-6">
            <Trophy className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">Připrav se na zkoušky</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {displayExamTracks.map((subject, index) => (
              <SubjectCard key={subject.id || subject.name} subject={subject} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
