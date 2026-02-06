import React, { useEffect, useMemo, useRef } from 'react';
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

function intensityText(v, max) {
  // aby bylo číslo čitelné i na světlém kroužku
  if (!v) return 'text-slate-600';
  const m = max || 1;
  const r = v / m;
  if (r <= 0.25) return 'text-slate-800';
  return 'text-white';
}

function buildMonthCalendar(year, month, activityMap) {
  // month: 0-based
  const first = new Date(year, month, 1);
  const jsDow = first.getDay(); // 0..6 (Ne..So)
  const offset = (jsDow + 6) % 7; // Po=0 ... Ne=6

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);

  let max = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const iso = isoLocalDate(dt);
    const v = Number(activityMap.get(iso) || 0);
    max = Math.max(max, v);
    cells.push({ d, iso, v });
  }

  return {
    year,
    month,
    monthLabel: `${monthNameCZ(month)} ${year}`,
    cells,
    max,
  };
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

  // Seed data ze Supabase (cvičení)
  const { data: exercises = [] } = useQuery({
    queryKey: ['allExercises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, topic_id, category_id, type, payload');

      if (error) throw error;

      return (data || []).map((r) => ({
        id: r.id,
        topic_id: r.topic_id,
        category_id: r.category_id,
        type: r.type,
        payload: r.payload,
        is_test: !!(r?.payload?.is_test) || r.type === 'test',
      }));
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // ✅ Map id -> is_test a Set všech id (aby se statistiky počítaly jen z existujících cvičení)
  const exerciseIdSet = useMemo(() => new Set((exercises || []).map((e) => String(e.id))), [exercises]);
  const isTestById = useMemo(() => {
    const m = new Map();
    for (const e of exercises || []) {
      m.set(String(e.id), !!e.is_test);
    }
    return m;
  }, [exercises]);

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
      from.setDate(from.getDate() - 365); // ✅ až rok zpět
      const fromIso = isoLocalDate(from);

      const { data, error } = await supabase
        .from('user_daily_activity')
        .select('day, exercises_completed')
        .eq('user_id', user.id)
        .gte('day', fromIso)
        .order('day', { ascending: true });

      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const hasSbProgress = !!user?.id && (sbProgressRows?.length || 0) > 0;

  // --- Normalizace progressu (Supabase) ---
  const sbProgressMap = useMemo(() => {
    const m = new Map();
    for (const r of sbProgressRows || []) {
      const exId = String(r.exercise_id);
      if (exerciseIdSet.size > 0 && !exerciseIdSet.has(exId)) continue;
      if (isTestById.get(exId)) continue;
      m.set(exId, {
        completed: !!r.completed,
        stars: Number(r.best_stars ?? r.stars ?? 0) || 0,
        score: Number(r.best_score ?? r.score ?? 0) || 0,
      });
    }
    return m;
  }, [sbProgressRows, exerciseIdSet, isTestById]);

  // --- Local progress map (fallback) ---
  const localProgressMap = useMemo(() => {
    const map = getProgressMap();
    const m = new Map();
    for (const [id, p] of Object.entries(map || {})) {
      m.set(String(id), {
        completed: !!p.completed,
        stars: Number(p.bestStars ?? p.stars ?? 0) || 0,
        score: Number(p.bestScore ?? p.score ?? 0) || 0,
      });
    }
    return m;
  }, []);

  const getExerciseProgress = (exerciseId) => {
    const id = String(exerciseId);
    if (hasSbProgress && sbProgressMap.has(id)) return sbProgressMap.get(id);
    if (!hasSbProgress && localProgressMap.has(id)) return localProgressMap.get(id);
    return null;
  };

  // =========================
  // ✅✅✅ AKTIVITA (JEDINÉ ZMĚNY JSOU TADY)
  // =========================

  // 1) Primární mapování z user_daily_activity
  const activityMapFromTable = useMemo(() => {
    const m = new Map();
    for (const r of dailyActivity || []) {
      const key = String(r.day || '').slice(0, 10);
      m.set(key, Number(r.exercises_completed || 0));
    }
    return m;
  }, [dailyActivity]);

  // 2) Fallback: když tabulka user_daily_activity nic nevrací, dopočítej aktivitu z progressů
  const activityMapFallbackFromProgress = useMemo(() => {
    const m = new Map();

    for (const r of sbProgressRows || []) {
      const exId = String(r.exercise_id);
      if (exerciseIdSet.size > 0 && !exerciseIdSet.has(exId)) continue;
      if (isTestById.get(exId)) continue;
      if (!r.completed) continue;

      const rawDate = r.completed_at || r.updated_at || r.created_at || null;
      if (!rawDate) continue;

      const day = String(rawDate).slice(0, 10);
      if (!day || day.length !== 10) continue;

      m.set(day, (m.get(day) || 0) + 1);
    }

    return m;
  }, [sbProgressRows, exerciseIdSet, isTestById]);

  // 3) Finální activityMap: preferuj user_daily_activity, ale když je prázdná, použij fallback
  const activityMap = useMemo(() => {
    if ((dailyActivity || []).length > 0) return activityMapFromTable;
    return activityMapFallbackFromProgress;
  }, [dailyActivity, activityMapFromTable, activityMapFallbackFromProgress]);

  // --- Kalendáře: rok zpět + měsíc dopředu (ale teď se bude přepínat přes tlačítka) ---
  const calendarRange = useMemo(() => {
    const now = new Date();
    const todayIso = isoLocalDate(now);

    const start = new Date(now);
    start.setDate(1);
    start.setMonth(start.getMonth() - 12);

    const end = new Date(now);
    end.setDate(1);
    end.setMonth(end.getMonth() + 1);

    const months = [];
    const cur = new Date(start);

    while (cur <= end) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const cal = buildMonthCalendar(y, m, activityMap);
      const key = `${y}-${m}`;
      months.push({ ...cal, key, todayIso });
      cur.setMonth(cur.getMonth() + 1);
    }

    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    return { months, todayIso, currentKey };
  }, [activityMap]);

  // ✅ defaultně vybraný je aktuální měsíc (a zůstává při refreshi dat)
  const [selectedMonthKey, setSelectedMonthKey] = React.useState('');
  useEffect(() => {
    if (!selectedMonthKey && calendarRange.currentKey) {
      setSelectedMonthKey(calendarRange.currentKey);
    }
    // pokud by se stalo, že vybraný klíč v novém rozsahu neexistuje, vrať na current
    if (selectedMonthKey) {
      const exists = calendarRange.months.some((m) => m.key === selectedMonthKey);
      if (!exists && calendarRange.currentKey) setSelectedMonthKey(calendarRange.currentKey);
    }
  }, [calendarRange.currentKey, calendarRange.months, selectedMonthKey]);

  const selectedCalendar = useMemo(() => {
    return calendarRange.months.find((m) => m.key === selectedMonthKey) || null;
  }, [calendarRange.months, selectedMonthKey]);

  // label: "02/2025"
  const monthChipLabel = (cal) => {
    const mm = String(cal.month + 1).padStart(2, '0');
    return `${mm}/${cal.year}`;
  };

  // =========================
  // ✅✅✅ KONEC AKTIVITY ZMĚN
  // =========================

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                {avatarLetter}
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{displayName}</div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user.email}</span>
                </div>
              </div>
            </div>

            {rankBadge ? (
              <Link to={createPageUrl('Leaderboard')}>
                <div className={`px-3 py-2 rounded-full text-sm font-bold shadow-sm ${rankBadge.cls}`}>
                  {rankBadge.text}
                </div>
              </Link>
            ) : (
              <Link to={createPageUrl('Leaderboard')}>
                <div className="px-3 py-2 rounded-full text-sm font-bold bg-slate-100 text-slate-500">
                  🎖️
                </div>
              </Link>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="mb-8"
        >
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

        {/* ✅ Aktivita – MĚSÍČNÍ TLAČÍTKA + JEDEN KALENDÁŘ */}
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
                <span className="text-sm text-slate-500">Vyber měsíc</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Čím tmavší kroužek, tím víc cvičení. Najetím zobrazíš detail.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* měsíční tlačítka */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
                {calendarRange.months.map((m) => {
                  const active = m.key === selectedMonthKey;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setSelectedMonthKey(m.key)}
                      className={[
                        'shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition',
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      ].join(' ')}
                      title={m.monthLabel}
                      type="button"
                    >
                      {monthChipLabel(m)}
                    </button>
                  );
                })}
              </div>

              {/* vybraný měsíc */}
              {selectedCalendar ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-700">{selectedCalendar.monthLabel}</div>
                    <div className="text-xs text-slate-400">
                      {selectedCalendar.max ? `Max den: ${selectedCalendar.max} cvičení` : 'Bez aktivity'}
                    </div>
                  </div>

                  {/* dny v týdnu */}
                  <div className="grid grid-cols-7 gap-1 mb-1 text-[11px] text-slate-400">
                    {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d) => (
                      <div key={`${selectedCalendar.monthLabel}-${d}`} className="text-center">{d}</div>
                    ))}
                  </div>

                  {/* kalendář (větší dny + menší mezery) */}
                  <div className="grid grid-cols-7 gap-1">
                    {selectedCalendar.cells.map((cell, idx) => {
                      if (!cell) {
                        return <div key={`${selectedCalendar.monthLabel}-empty-${idx}`} className="h-11" />;
                      }

                      const isToday = cell.iso === selectedCalendar.todayIso;
                      const ring = intensityBg(cell.v, selectedCalendar.max);

                      return (
                        <div key={cell.iso} className="relative group h-11 flex items-center justify-center">
                          <div
                            className={[
                              'w-11 h-11 rounded-full flex items-center justify-center',
                              ring,
                              'ring-1 ring-slate-200',
                              isToday ? 'ring-2 ring-slate-500' : '',
                            ].join(' ')}
                          >
                            <span className={['text-sm font-semibold', intensityText(cell.v, selectedCalendar.max)].join(' ')}>
                              {cell.d}
                            </span>
                          </div>

                          <div
                            className="
                              pointer-events-none
                              absolute -top-11 left-1/2 -translate-x-1/2
                              whitespace-nowrap
                              opacity-0 group-hover:opacity-100
                              transition
                              text-xs
                              bg-slate-900 text-white
                              px-2 py-1 rounded-md
                              shadow-lg
                            "
                          >
                            {cell.d}. {String(selectedCalendar.month + 1).padStart(2, '0')}. {selectedCalendar.year} • {cell.v} cvičení
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* legenda */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span>Méně</span>
                    <span className="inline-block w-3 h-3 rounded-full bg-slate-100 ring-1 ring-slate-200" />
                    <span className="inline-block w-3 h-3 rounded-full bg-emerald-200 ring-1 ring-slate-200" />
                    <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 ring-1 ring-slate-200" />
                    <span className="inline-block w-3 h-3 rounded-full bg-emerald-600 ring-1 ring-slate-200" />
                    <span>Více</span>
                  </div>
                </div>
              ) : null}
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Výkon podle předmětů</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {subjects.map((s) => {
                const stats = getSubjectStats(s);
                const color = subjectColors[s] || subjectColors['Čeština'];

                if (stats.totalExercises === 0) return null;

                return (
                  <div key={s} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800">{s}</div>
                        <div className="text-xs text-slate-500">
                          {stats.completed} z {stats.totalExercises} cvičení dokončeno
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-slate-700">{stats.avgScore}%</div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>Dokončeno</span>
                        <span>{stats.completionRate}%</span>
                      </div>
                      <Progress value={stats.completionRate} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div className="text-sm">
                        <div className="text-slate-500">Hvězdičky</div>
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold">{stats.totalStars}</span>
                          <span className="text-slate-400">/ {stats.maxStars}</span>
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="text-slate-500">Průměr</div>
                        <div className="font-bold">{stats.avgScore}%</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div>
                        <div className="text-sm text-slate-600 flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-rose-500" />
                          <span className="font-medium">Kde můžeš zlepšit</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {stats.weakestTopics.map((t) => (
                            <Link key={t.topic.id} to={getTopicLink(t.topic.id)} className="block">
                              <div className="flex items-center justify-between text-sm p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                                <div>
                                  <div className="font-medium text-slate-800">{t.topic.name}</div>
                                  <div className="text-xs text-slate-500">{t.topic.grade}.</div>
                                </div>
                                <div className="font-bold text-rose-600">{Math.round(t.avgScore)}%</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-slate-600 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <span className="font-medium">Tvoje silné stránky</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {stats.strongestTopics.map((t) => (
                            <Link key={t.topic.id} to={getTopicLink(t.topic.id)} className="block">
                              <div className="flex items-center justify-between text-sm p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition">
                                <div>
                                  <div className="font-medium text-slate-800">{t.topic.name}</div>
                                  <div className="text-xs text-slate-500">{t.topic.grade}.</div>
                                </div>
                                <div className="font-bold text-emerald-600">{Math.round(t.avgScore)}%</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Zabezpečení</CardTitle>
              <CardDescription>Změň si heslo.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">Nové heslo</div>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">Potvrdit heslo</div>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button
                className="w-full md:w-auto h-12 px-6 text-base rounded-xl"
                onClick={async () => {
                  if (!newPassword || newPassword.length < 6) {
                    alert('Heslo musí mít alespoň 6 znaků.');
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    alert('Hesla se neshodují.');
                    return;
                  }

                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) {
                    alert(error.message);
                    return;
                  }

                  setNewPassword('');
                  setConfirmPassword('');
                  alert('Heslo bylo změněno.');
                }}
              >
                <Lock className="w-4 h-4 mr-2" />
                Změnit heslo
              </Button>

              <div className="flex items-start gap-2 text-sm text-slate-500">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>
                  Změna hesla je okamžitá pro aktuální účet.
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
