import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ArrowLeft,
  Mail,
  Star,
  Trophy,
  TrendingUp,
  TrendingDown,
  Lock,
  CheckCircle2,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabaseClient';
import { fetchMyProgress } from '@/lib/progressApi';
import { getProgressMap } from '@/lib/progressStore';

function getRankBadge(rankInfo) {
  if (!rankInfo) return null;

  const { rank, totalUsers, percentile } = rankInfo;

  if (rank === 1) return { text: '🥇 #1', cls: 'bg-yellow-400 text-white' };
  if (rank === 2) return { text: '🥈 #2', cls: 'bg-slate-400 text-white' };
  if (rank === 3) return { text: '🥉 #3', cls: 'bg-amber-600 text-white' };

  if (rank <= 10) return { text: 'TOP 10', cls: 'bg-purple-600 text-white' };
  if (rank <= 25) return { text: 'TOP 25', cls: 'bg-indigo-600 text-white' };
  if (rank <= 50) return { text: 'TOP 50', cls: 'bg-blue-600 text-white' };
  if (rank <= 100) return { text: 'TOP 100', cls: 'bg-sky-600 text-white' };

  const safePct = Math.min(Math.max(Number(percentile || 0), 1), 100);
  return { text: `TOP ${safePct}%`, cls: 'bg-slate-200 text-slate-700' };
}

function isoLocalDate(d) {
  // lokální datum -> YYYY-MM-DD (bez posunu UTC)
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthNameCZ(monthIndex) {
  // 0-based
  const names = [
    'Leden',
    'Únor',
    'Březen',
    'Duben',
    'Květen',
    'Červen',
    'Červenec',
    'Srpen',
    'Září',
    'Říjen',
    'Listopad',
    'Prosinec',
  ];
  return names[monthIndex] || '';
}

function intensityBg(v, max) {
  // jemné úrovně (kroužek kolem čísla)
  if (!v) return 'bg-slate-100';
  const m = max || 1;
  const r = v / m;

  if (r <= 0.25) return 'bg-emerald-200';
  if (r <= 0.55) return 'bg-emerald-400';
  return 'bg-emerald-600';
}

export default function Profile() {
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  // ✅ Supabase user (stejně jako Home)
  const { data: user } = useQuery({
    queryKey: ['sbUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    },
  });

  // ✅ Profil z tabulky profiles (username)
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, created_at')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // ✅ STREAK
  const { data: streakRow } = useQuery({
    queryKey: ['userStreak', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('streak_count, longest_streak, longest_streak_date, last_active_date')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return null;
      return data || null;
    },
    enabled: !!user?.id,
  });

  const streakCount = Number(streakRow?.streak_count ?? 0) || 0;
  const longestStreak = Number(streakRow?.longest_streak ?? 0) || 0;
  const longestStreakDate = streakRow?.longest_streak_date || null;

  // ✅ RANK BADGE (LeaderBoard pozice)
  const { data: rankInfo } = useQuery({
    queryKey: ['myRank', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('leaderboard_stars')
        .select('user_id, total_stars')
        .order('total_stars', { ascending: false })
        .limit(5000);

      if (error) return null;
      const list = data || [];
      const totalUsers = list.length;
      if (totalUsers === 0) return null;

      const idx = list.findIndex((r) => String(r.user_id) === String(user.id));
      if (idx === -1) return null;

      const rank = idx + 1;
      const percentile = Math.ceil((rank / totalUsers) * 100);

      return { rank, totalUsers, percentile };
    },
    enabled: !!user?.id,
  });

  const rankBadge = getRankBadge(rankInfo);

  // Seed data z Base44 (témata/cvičení)
  const { data: exercises = [] } = useQuery({
    queryKey: ['allExercises'],
    queryFn: () => base44.entities.Exercise.list(),
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['allTopics'],
    queryFn: () => base44.entities.Topic.list(),
  });

  // ✅ kategorie pro rozlišení linku na téma (Categories vs Exercises)
  const { data: categories = [] } = useQuery({
    queryKey: ['allCategories'],
    queryFn: () => base44.entities.Category.list('order'),
  });

  // ✅ Supabase progress rows
  const { data: sbProgressRows = [] } = useQuery({
    queryKey: ['userProgress', user?.id],
    queryFn: async () => {
      const rows = await fetchMyProgress();
      return rows || [];

    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // ✅ Denní aktivita (kolik cvičení denně) – pro kalendář v profilu
  const { data: dailyActivity = [] } = useQuery({
    queryKey: ['dailyActivity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const from = new Date();
      from.setDate(from.getDate() - 120); // ať to pokryje měsíc i při přelomu
      const fromISO = isoLocalDate(from);

      const { data, error } = await supabase
        .from('user_daily_activity')
        .select('day, exercises_done')
        .eq('user_id', user.id)
        .gte('day', fromISO)
        .order('day', { ascending: true });

      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,

  });

  // --- Normalizace progressu (Supabase) ---
  const sbProgressMap = useMemo(() => {
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

  const hasSbProgress = !!user?.id && (sbProgressRows?.length || 0) > 0;

  // --- Local fallback ---
  const localProgressMap = useMemo(() => {
    try {
      return getProgressMap() || {};
    } catch {
      return {};
    }
  }, []);

  const getExerciseProgress = (exerciseId) => {
    const id = String(exerciseId);

    // 1) preferuj Supabase
    const sb = sbProgressMap.get(id);
    if (sb) return sb;

    // 2) fallback na localStorage (jen když Supabase pro tohle id nic nemá)
    const lp = localProgressMap[id] || localProgressMap[exerciseId];
    if (!lp) return null;

    return {
      completed: !!lp.completed,
      stars: Number(lp.bestStars ?? lp.stars ?? 0) || 0,
      score: Number(lp.bestScore ?? lp.score ?? 0) || 0,
    };
  };


  // --- Aktivita: mapování den -> počet cvičení ---
  const activityMap = useMemo(() => {
    const m = new Map();
    for (const r of dailyActivity || []) {
      m.set(String(r.day), Number(r.exercises_done || 0));
    }
    return m;
  }, [dailyActivity]);

  // --- Kalendář aktuálního měsíce (čísla + kroužek) ---
  const calendar = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);

    // pondělí = 0 ... neděle = 6
    const jsDay = first.getDay(); // 0=neděle
    const mondayIndex = (jsDay + 6) % 7; // pondělí=0

    const daysInMonth = last.getDate();
    const cells = [];

    // padding před 1. dnem
    for (let i = 0; i < mondayIndex; i++) cells.push(null);

    // dny
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const iso = isoLocalDate(date);
      const v = activityMap.get(iso) || 0;
      cells.push({ d, iso, v });
    }

    const max = Math.max(1, ...cells.filter(Boolean).map((x) => x.v || 0));
    return {
      year: y,
      month: m,
      monthLabel: `${monthNameCZ(m)} ${y}`,
      cells,
      max,
      todayIso: isoLocalDate(now),
    };
  }, [activityMap]);

  const subjects = ['Čeština', 'Angličtina', 'Matematika'];

  const subjectColors = {
    Čeština: { bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-600' },
    Angličtina: { bg: 'bg-orange-50', text: 'text-orange-600', gradient: 'from-orange-500 to-amber-600' },
    Matematika: { bg: 'bg-blue-50', text: 'text-blue-600', gradient: 'from-blue-500 to-indigo-600' },
  };

  const topicHasCategories = (topicId) =>
    (categories || []).some((c) => String(c.topic_id) === String(topicId));

  const getTopicLink = (topicId) => {
    if (topicHasCategories(topicId)) return createPageUrl(`Categories?topic=${topicId}`);
    return createPageUrl(`Exercises?topic=${topicId}`);
  };

  // ✅ Stats podle předmětu (PŮVODNÍ – jak to máš ve starém profilu)
  const getSubjectStats = (subjectName) => {
    const subjectTopics = topics.filter((t) => t.subject === subjectName);
    const subjectTopicIds = new Set(subjectTopics.map((t) => String(t.id)));

    const subjectExercises = exercises.filter((e) => subjectTopicIds.has(String(e.topic_id)) && !e.is_test);
    const totalExercises = subjectExercises.length;

    let completed = 0;
    let totalStars = 0;
    let sumScore = 0;
    let scoreCount = 0;

    for (const ex of subjectExercises) {
      const p = getExerciseProgress(ex.id);
      if (!p) continue;

      if (p.completed) completed += 1;
      totalStars += p.stars || 0;

      sumScore += p.score || 0;
      scoreCount += 1;
    }

    const avgScore = scoreCount > 0 ? Math.round(sumScore / scoreCount) : 0;
    const maxStars = totalExercises * 3;

    const topicPerformance = subjectTopics
      .map((topic) => {
        const topicExercises = exercises.filter((e) => String(e.topic_id) === String(topic.id) && !e.is_test);

        let topicSum = 0;
        let topicCount = 0;

        for (const ex of topicExercises) {
          const p = getExerciseProgress(ex.id);
          if (!p) continue;
          topicSum += p.score || 0;
          topicCount += 1;
        }

        const topicAvg = topicCount > 0 ? topicSum / topicCount : 0;
        return { topic, avgScore: topicAvg, count: topicCount };
      })
      .filter((t) => t.count > 0)
      .sort((a, b) => a.avgScore - b.avgScore);

    return {
      completed,
      totalExercises,
      avgScore,
      totalStars,
      maxStars,
      completionRate: totalExercises > 0 ? Math.round((completed / totalExercises) * 100) : 0,
      weakestTopics: topicPerformance.slice(0, 3),
      strongestTopics: topicPerformance.slice(-3).reverse(),
    };
  };

  // Overall stats (PŮVODNÍ)
  const overallStats = useMemo(() => {
    let totalCompleted = 0;
    let totalStars = 0;
    let sumScore = 0;
    let scoreCount = 0;

    for (const ex of exercises) {
      if (ex.is_test) continue;
      const p = getExerciseProgress(ex.id);
      if (!p) continue;

      if (p.completed || (p.score ?? 0) > 0 || (p.stars ?? 0) > 0) {
     totalCompleted += 1;
      }
      totalStars += p.stars || 0;

      sumScore += p.score || 0;
      scoreCount += 1;
    }

    const overallAvg = scoreCount > 0 ? Math.round(sumScore / scoreCount) : 0;
    return { totalCompleted, totalStars, overallAvg };
  }, [exercises, sbProgressMap, localProgressMap, hasSbProgress]);

  if (!user) return null;

  const { totalCompleted, totalStars, overallAvg } = overallStats;

  const displayName =
    profile?.username ||
    user.user_metadata?.full_name ||
    user.email ||
    'Uživatel';

  const avatarLetter = (String(displayName)[0] || 'U').toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Home')}>
          <Button variant="ghost" className="mb-6 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Zpět
          </Button>
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-3xl text-white font-bold">{avatarLetter}</span>
            </div>

            <div className="flex-1 min-w-0">
              {/* řádek se jménem + badge doprava */}
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-bold text-slate-800 truncate">{displayName}</h1>

                {rankBadge && (
                  <Link
                    to={createPageUrl('Leaderboard')}
                    title="Otevřít žebříček"
                    className={`
                      shrink-0 inline-flex items-center gap-2
                      px-4 py-2 rounded-full
                      text-sm font-extrabold
                      transition
                      hover:scale-[1.03] active:scale-[0.97]
                      hover:shadow-md
                      ${rankBadge.cls}
                    `}
                  >
                    <span className="text-base">🏆</span>
                    <span>{rankBadge.text}</span>
                  </Link>
                )}
              </div>

              <p className="text-slate-500 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-500">Splněných cvičení</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <span className="text-3xl font-bold text-slate-800">{totalCompleted}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-500">Celkových hvězdiček</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                  <span className="text-3xl font-bold text-slate-800">{totalStars}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-500">Průměrné skóre</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-orange-500" />
                  <span className="text-3xl font-bold text-slate-800">{overallAvg}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-500">Daily streak</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Flame className="w-8 h-8 text-orange-500" />
                  <div>
                    <div className="text-3xl font-bold text-slate-800">{streakCount}</div>
                    <div className="text-sm text-slate-500">
                      Rekord: <span className="font-medium text-slate-700">{longestStreak}</span>
                      {longestStreakDate ? <span className="text-slate-400"> • {longestStreakDate}</span> : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* ✅ Aktivita – MALÝ KALENDÁŘ (čísla + kroužek, hover tooltip) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-8"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Aktivita</span>
                <span className="text-sm text-slate-500">{calendar.monthLabel}</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Čím tmavší kroužek, tím víc cvičení. Najetím zobrazíš detail.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* dny v týdnu */}
              <div className="grid grid-cols-7 gap-2 mb-2 text-xs text-slate-400">
                {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d) => (
                  <div key={d} className="text-center">{d}</div>
                ))}
              </div>

              {/* kalendář */}
              <div className="grid grid-cols-7 gap-2">
                {calendar.cells.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}`} className="h-9" />;
                  }

                  const isToday = cell.iso === calendar.todayIso;
                  const ring = intensityBg(cell.v, calendar.max);

                  return (
                    <div key={cell.iso} className="relative group h-9 flex items-center justify-center">
                      {/* kroužek */}
                      <div
                        className={[
                          'w-9 h-9 rounded-full flex items-center justify-center',
                          ring,
                          'ring-1 ring-slate-200',
                          isToday ? 'ring-2 ring-slate-400' : '',
                        ].join(' ')}
                      >
                        <span className={['text-xs font-semibold', cell.v ? 'text-white' : 'text-slate-600'].join(' ')}>
                          {cell.d}
                        </span>
                      </div>

                      {/* tooltip */}
                      <div
                        className="
                          pointer-events-none
                          absolute -top-10 left-1/2 -translate-x-1/2
                          whitespace-nowrap
                          opacity-0 group-hover:opacity-100
                          transition
                          text-xs
                          bg-slate-900 text-white
                          px-2 py-1 rounded-md
                          shadow-lg
                        "
                      >
                        {cell.d}. {String(calendar.month + 1).padStart(2, '0')}. {calendar.year} • {cell.v} cvičení
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* legenda */}
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <span>Méně</span>
                <span className="inline-block w-3 h-3 rounded-full bg-slate-100 ring-1 ring-slate-200" />
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-200 ring-1 ring-slate-200" />
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 ring-1 ring-slate-200" />
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-600 ring-1 ring-slate-200" />
                <span>Více</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subject Performance (PŮVODNÍ velké bloky) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Výkon podle předmětů</h2>

          <div className="grid gap-6">
            {subjects.map((subject, index) => {
              const stats = getSubjectStats(subject);
              const colors = subjectColors[subject];

              return (
                <motion.div
                  key={subject}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{subject}</span>
                        <span className={`text-2xl font-bold ${colors.text}`}>{stats.avgScore}%</span>
                      </CardTitle>
                      <CardDescription>
                        {stats.completed} z {stats.totalExercises} cvičení dokončeno
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-500">Dokončeno</span>
                          <span className="font-medium">{stats.completionRate}%</span>
                        </div>
                        <Progress value={stats.completionRate} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Hvězdičky</div>
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            <span className="font-bold">{stats.totalStars}</span>
                            <span className="text-slate-400">/ {stats.maxStars}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Průměr</div>
                          <div className="font-bold text-lg">{stats.avgScore}%</div>
                        </div>
                      </div>

                      {stats.weakestTopics.length > 0 && (
                        <div className="border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            Kde můžeš zlepšit
                          </div>
                          <div className="space-y-2">
                            {stats.weakestTopics.map((item, idx) => (
                              <Link key={idx} to={getTopicLink(item.topic.id)} className="block">
                                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{item.topic.name}</div>
                                    <div className="text-xs text-slate-500">{item.topic.grade}. třída</div>
                                  </div>
                                  <div className="text-sm font-medium text-red-600">
                                    {Math.round(item.avgScore)}%
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {stats.strongestTopics.length > 0 && (
                        <div className="border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Tvoje silné stránky
                          </div>
                          <div className="space-y-2">
                            {stats.strongestTopics.map((item, idx) => (
                              <Link key={idx} to={getTopicLink(item.topic.id)} className="block">
                                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{item.topic.name}</div>
                                    <div className="text-xs text-slate-500">{item.topic.grade}. třída</div>
                                  </div>
                                  <div className="text-sm font-medium text-emerald-600">
                                    {Math.round(item.avgScore)}%
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Change Password (PŮVODNÍ hezký blok s textem) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Změna hesla
              </CardTitle>
              <CardDescription>Aktualizujte své heslo pro lepší zabezpečení</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Změna hesla není v této verzi podporována. Kontaktujte administrátora.
                </p>
              </div>

              <div className="space-y-3 opacity-50 pointer-events-none">
                <div>
                  <label className="text-sm font-medium text-slate-700">Nové heslo</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Alespoň 6 znaků"
                    disabled
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Potvrdit heslo</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Zadejte heslo znovu"
                    disabled
                  />
                </div>

                <Button disabled className="w-full">
                  Změnit heslo
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
