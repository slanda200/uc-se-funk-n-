import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft,
  Star,
  Home,
  RotateCcw,
  Trophy,
  ListChecks,
  CircleStop,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import FillExercise from '@/components/exercises/FillExercise';
import MatchExercise from '@/components/exercises/MatchExercise';
import MemoryExercise from '@/components/exercises/MemoryExercise';
import QuizExercise from '@/components/exercises/QuizExercise';
import DecisionExercise from '@/components/exercises/DecisionExercise';
import SortExercise from '@/components/exercises/SortExercise';
import AnalysisExercise from '@/components/exercises/AnalysisExercise';
import ClozeExercise from '@/components/exercises/ClozeExercise';
import TestExercise from '@/components/exercises/TestExercise';
import ListeningExercise from '@/components/exercises/ListeningExercise';
import ImageExercise from '@/components/exercises/ImageExercise';

import { saveProgress } from "@/lib/progressStore";
import { supabase } from "@/lib/supabaseClient";
import { upsertProgress } from "@/lib/progressApi";

// --- localStorage helpers ---
const attemptKey = (exerciseId) => `attempts:${String(exerciseId)}`;

function loadAttempts(exerciseId) {
  try {
    const raw = localStorage.getItem(attemptKey(exerciseId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushAttempt(exerciseId, attempt) {
  const list = loadAttempts(exerciseId);
  list.unshift(attempt); // newest first
  localStorage.setItem(attemptKey(exerciseId), JSON.stringify(list.slice(0, 20))); // keep last 20
}

// ----------------------------
// ✅ difficulty helpers (1..3)
// ----------------------------
function getExerciseDifficulty(ex) {
  const d = ex?.difficulty;
  const n = typeof d === "string" ? Number(d) : d;
  return Number.isFinite(n) ? n : null; // 1..3
}
function clampDifficulty(n) {
  if (!Number.isFinite(n)) return null;
  if (n < 1) return 1;
  if (n > 3) return 3;
  return n;
}
function harderDifficulty(current) {
  const c = clampDifficulty(current);
  return c === null ? null : Math.min(3, c + 1);
}
function easierDifficulty(current) {
  const c = clampDifficulty(current);
  return c === null ? null : Math.max(1, c - 1);
}

// ----------------------------
// ✅ "jiný typ úlohy" preference
// ----------------------------
const TYPE_FALLBACK_ORDER = ['quiz', 'decision', 'fill', 'cloze', 'match', 'sort', 'memory', 'analysis', 'listening', 'image', 'test'];

function pickDifferentTypeExercise(exercises, currentType) {
  if (!Array.isArray(exercises) || exercises.length === 0) return null;
  for (const t of TYPE_FALLBACK_ORDER) {
    if (t === currentType) continue;
    const found = exercises.find((e) => e?.type === t);
    if (found) return found;
  }
  return exercises.find((e) => e?.type && e.type !== currentType) || null;
}

export default function Play() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const exerciseId = urlParams.get('exercise');

  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState(null);

  // ✅ modal pro předčasné ukončení
  const [showEarlyExit, setShowEarlyExit] = useState(false);

  // ✅ supabase user
  const [user, setUser] = useState(null);

  // ✅ COMBO / STREAK
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [comboMsg, setComboMsg] = useState(null);

  // ✅ ATTEMPT tracking
  const attemptIdRef = useRef(null);
  const attemptItemsRef = useRef([]);
  const [lastAttemptId, setLastAttemptId] = useState(null);

  // ✅ dedupe streaku
  const streakGuardRef = useRef({ ts: 0, val: null });

  // ✅ guard proti dvojímu zapsání "daily activity"
  const dailyActivityGuardRef = useRef({ key: null });

  // ✅ reset attempt id když se změní exercise
  useEffect(() => {
    attemptIdRef.current = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    attemptItemsRef.current = [];
    setLastAttemptId(null);

    // reset daily activity guard (nové cvičení = nový klíč)
    dailyActivityGuardRef.current = { key: null };
  }, [exerciseId]);

  // ✅ DŮLEŽITÝ FIX:
  // když se změní URL (nové exerciseId), tak VYPNI completion screen
  useEffect(() => {
    setIsComplete(false);
    setResult(null);
    setShowEarlyExit(false);

    // reset streak
    setCombo(0);
    setBestCombo(0);
    setComboMsg(null);

    // reset guard
    streakGuardRef.current = { ts: 0, val: null };
  }, [exerciseId]);

  // Auth
  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data?.user || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const { data: exercise, isLoading } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: async () => {
      const exercises = await base44.entities.Exercise.filter({ id: exerciseId });
      return exercises[0];
    },
    enabled: !!exerciseId,
  });

  const { data: topic } = useQuery({
    queryKey: ['topic', exercise?.topic_id],
    queryFn: async () => {
      const topics = await base44.entities.Topic.filter({ id: exercise.topic_id });
      return topics[0];
    },
    enabled: !!exercise?.topic_id,
  });

  // ✅ všechny úlohy v topicu (kvůli "Další úloha")
  const { data: topicExercises = [] } = useQuery({
    queryKey: ['topicExercises', exercise?.topic_id],
    queryFn: async () => {
      if (!exercise?.topic_id) return [];
      const list = await base44.entities.Exercise.filter({ topic_id: exercise.topic_id });
      return Array.isArray(list) ? list : [];
    },
    enabled: !!exercise?.topic_id,
  });

  // ✅ streak callback
  const onAnswerResult = React.useCallback((isCorrect) => {
    const now = Date.now();
    const last = streakGuardRef.current;
    if (last && last.val === isCorrect && (now - last.ts) < 80) return;
    streakGuardRef.current = { ts: now, val: isCorrect };

    if (isCorrect) {
      setCombo((c) => {
        const next = c + 1;
        setBestCombo((b) => Math.max(b, next));

        if (next >= 2) {
          const text =
            next === 2 ? "🔥 Dobře! 2× správně" :
            next === 3 ? "🚀 Skvělé! 3× za sebou" :
            next === 5 ? "🏆 Mega! 5× v řadě" :
            `⚡ Combo ${next}×`;

          setComboMsg(text);

          if (onAnswerResult._t) window.clearTimeout(onAnswerResult._t);
          onAnswerResult._t = window.setTimeout(() => setComboMsg(null), 1200);
        }
        return next;
      });
    } else {
      setCombo(0);
      setComboMsg(null);
    }
  }, []);

  // ✅ attempt items
  const onAttemptItem = React.useCallback((item) => {
    if (!item) return;
    const list = attemptItemsRef.current || [];
    const idx = list.findIndex((x) => x.index === item.index);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    attemptItemsRef.current = list;
  }, []);

  const handleComplete = async (scoreOrData, starsMaybe) => {
    const resultData =
      typeof scoreOrData === 'object' && scoreOrData !== null
        ? { score: scoreOrData.score, stars: scoreOrData.stars }
        : { score: scoreOrData, stars: starsMaybe };

    setResult(resultData);
    setIsComplete(true);

    const attemptId = attemptIdRef.current || `${Date.now()}`;
    const attempt = {
      id: attemptId,
      createdAt: new Date().toISOString(),
      exerciseId,
      exerciseTitle: exercise?.title || null,
      topicName: topic?.name || null,
      score: resultData.score,
      stars: resultData.stars,
      bestCombo,
      items: (attemptItemsRef.current || []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)),
      topicId: exercise?.topic_id || null,
    };

    pushAttempt(exerciseId, attempt);
    setLastAttemptId(attemptId);

    saveProgress(exerciseId, {
      completed: true,
      score: resultData.score,
      stars: resultData.stars,
    });

    if (user?.id) {
      // 1) ulož progress
      try {
        await upsertProgress({
          exerciseId,
          score: resultData.score,
          stars: resultData.stars,
          completed: true,
        });

        queryClient.invalidateQueries({ queryKey: ['userProgress'] });
        queryClient.invalidateQueries({ queryKey: ['topicProgress'] });
      } catch (e) {
        console.error("❌ Nepodařilo se uložit progres do Supabase:", e);
      }

      // 2) ✅ inkrement denní aktivity (jen jednou na dokončení)
      try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const guardKey = `${user.id}:${String(exerciseId)}:${String(attemptId)}:${today}`;

        if (dailyActivityGuardRef.current.key !== guardKey) {
          dailyActivityGuardRef.current.key = guardKey;

          const { error } = await supabase.rpc('inc_daily_exercises', { p_day: today });
          if (error) {
            // když by RPC nebylo nebo RLS, uvidíš to tady
            console.error("❌ Nepodařilo se zapsat denní aktivitu:", error);
          } else {
            // ať se to na profilu ukáže hned
            queryClient.invalidateQueries({ queryKey: ['dailyActivity'] });
          }
        }
      } catch (e) {
        console.error("❌ Chyba při zápisu denní aktivity:", e);
      }
    }
  };

  const handleEarlyFinish = () => {
    const questions = Array.isArray(exercise?.questions) ? exercise.questions : [];
    const total = questions.length || 1;

    const items = Array.isArray(attemptItemsRef.current) ? [...attemptItemsRef.current] : [];
    const answered = new Set(items.map((x) => x?.index).filter((v) => Number.isFinite(v)));

    for (let i = 0; i < total; i++) {
      if (answered.has(i)) continue;
      const q = questions[i] || null;
      const prompt = (q?.question ?? q?.text ?? q?.prompt ?? `Otázka ${i + 1}`).toString();

      items.push({
        index: i,
        type: exercise?.type || 'exercise',
        prompt,
        userAnswer: '(přeskočeno)',
        correctAnswer: (q?.answer ?? '').toString(),
        correct: false,
        explanation: 'Ukončeno předčasně – otázka nebyla zodpovězena.',
        options: Array.isArray(q?.options) ? q.options : [],
      });
    }

    items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    attemptItemsRef.current = items;

    const correctCount = items.filter((x) => x?.correct).length;
    const score = Math.round((correctCount / total) * 100);
    const stars = score >= 80 ? 3 : score >= 60 ? 2 : 1;

    handleComplete({ score, stars });
  };

  const handleRetry = () => {
    setIsComplete(false);
    setResult(null);

    setCombo(0);
    setBestCombo(0);
    setComboMsg(null);

    attemptIdRef.current = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    attemptItemsRef.current = [];
    setLastAttemptId(null);

    streakGuardRef.current = { ts: 0, val: null };

    // reset daily activity guard (nový attempt)
    dailyActivityGuardRef.current = { key: null };
  };

  const subjectColors = {
    'Matematika': { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50' },
    'Čeština': { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50' },
    'Angličtina': { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50' },
  };

  const colors = subjectColors[topic?.subject] || subjectColors['Matematika'];

  // ✅ doporučení další úlohy podle score
  const recommendation = useMemo(() => {
    if (!isComplete || !result || !exercise) return null;

    const score = Number(result?.score ?? 0);
    const curType = exercise?.type || null;
    const curDiff = getExerciseDifficulty(exercise);

    const all = Array.isArray(topicExercises) ? topicExercises : [];
    const others = all.filter((e) => String(e?.id) !== String(exercise?.id));
    if (others.length === 0) return null;

    const sameDiff = (d) => others.filter((e) => getExerciseDifficulty(e) === d);

    // ≥ 75 → těžší (preferuj stejný typ)
    if (score >= 75) {
      const harder = harderDifficulty(curDiff);
      const poolHarder = harder ? sameDiff(harder) : [];

      const chosen =
        poolHarder.find((e) => e?.type === curType) ||
        poolHarder[0] ||
        others.find((e) => {
          const d = getExerciseDifficulty(e);
          return d !== null && curDiff !== null && d > curDiff;
        }) ||
        null;

      if (!chosen) return null;

      return {
        title: 'Ty brďo, ty válíš! 🔥',
        text: 'Chceš se posunout na těžší cvičení ve stejném tématu?',
        button: 'Jdu na těžší',
        exercise: chosen,
      };
    }

    // 20–74 → jiný typ (stejná obtížnost)
    if (score >= 20) {
      const pool = curDiff ? sameDiff(curDiff) : others;
      const chosen = pickDifferentTypeExercise(pool, curType) || pickDifferentTypeExercise(others, curType);
      if (!chosen) return null;

      return {
        title: 'Ještě trochu procvičit? 💪',
        text: 'Zkus stejné téma, ale jiným typem úlohy – často to pomůže.',
        button: 'Zkusit jiný typ',
        exercise: chosen,
      };
    }

    // < 20 → lehčí (nebo fallback: jiný typ)
    const easier = easierDifficulty(curDiff);
    const poolEasier = easier ? sameDiff(easier) : [];
    const chosenEasier = poolEasier[0] || null;

    if (chosenEasier) {
      return {
        title: 'Tohle bylo těžší… nevadí 🙂',
        text: 'Chceš zkusit lehčí úroveň ve stejném tématu?',
        button: 'Zkusit lehčí',
        exercise: chosenEasier,
      };
    }

    const fallback = pickDifferentTypeExercise(curDiff ? sameDiff(curDiff) : others, curType) || pickDifferentTypeExercise(others, curType);
    if (!fallback) return null;

    return {
      title: 'Zkusíme to jinak 🙂',
      text: 'Dáme stejné téma, ale jiným typem úlohy.',
      button: 'Jiný typ úlohy',
      exercise: fallback,
    };
  }, [isComplete, result, exercise, topicExercises]);

  const goToRecommended = () => {
    if (!recommendation?.exercise?.id) return;
    navigate(createPageUrl(`Play?exercise=${recommendation.exercise.id}`));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Načítám cvičení...</div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Cvičení nenalezeno</h2>
          <Link to={createPageUrl('Home')}>
            <Button>Zpět domů</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete && result) {
    const reviewUrl =
      lastAttemptId
        ? createPageUrl(`AttemptReview?exercise=${exerciseId}&attempt=${encodeURIComponent(lastAttemptId)}`)
        : createPageUrl(`AttemptReview?exercise=${exerciseId}`);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-yellow-50 to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-6 flex items-center justify-center"
          >
            <Trophy className="w-12 h-12 text-white" />
          </motion.div>

          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            {result.score >= 90 ? 'Výborně!' : result.score >= 70 ? 'Skvělá práce!' : result.score >= 50 ? 'Dobrá práce!' : 'Nevadí, zkus to znovu!'}
          </h2>

          <p className="text-slate-500 mb-6">{exercise.title}</p>

          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3].map((star, index) => (
              <motion.div
                key={star}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.2 }}
              >
                <Star
                  className={`w-12 h-12 ${
                    star <= result.stars ? 'text-yellow-400 fill-yellow-400 drop-shadow-lg' : 'text-slate-200'
                  }`}
                />
              </motion.div>
            ))}
          </div>

          <div className="text-4xl font-bold text-slate-800 mb-4">{result.score}%</div>

          {bestCombo >= 2 && (
            <div className="text-sm text-slate-500 mb-6">
              Nejlepší série v tomto cvičení: <span className="font-bold text-slate-700">{bestCombo}×</span>
            </div>
          )}

          {/* ✅ Doporučení + tlačítko Další úloha */}
          {recommendation?.exercise?.id && (
            <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-slate-700" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{recommendation.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{recommendation.text}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    Návrh: <span className="font-semibold">{recommendation.exercise.title}</span>
                  </div>
                </div>
              </div>

              <Button onClick={goToRecommended} className="w-full mt-3 h-12 rounded-2xl">
                {recommendation.button}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link to={reviewUrl} className="w-full">
              <Button variant="outline" className="w-full h-14 text-lg rounded-2xl border-2">
                <ListChecks className="w-5 h-5 mr-2" />
                Zobrazit, jak jsem si vedl
              </Button>
            </Link>

            <Button onClick={handleRetry} className={`h-14 text-lg rounded-2xl bg-gradient-to-r ${colors.gradient}`}>
              <RotateCcw className="w-5 h-5 mr-2" />
              Zkusit znovu
            </Button>

            <Link to={topic ? createPageUrl(`Exercises?topic=${topic.id}`) : createPageUrl('Home')} className="w-full">
              <Button variant="outline" className="w-full h-14 text-lg rounded-2xl border-2">
                Zpět na cvičení
              </Button>
            </Link>

            <Link to={createPageUrl('Home')} className="w-full">
              <Button variant="ghost" className="w-full h-12 rounded-2xl text-slate-500">
                <Home className="w-5 h-5 mr-2" />
                Domů
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const ExerciseComponent = {
    fill: FillExercise,
    match: MatchExercise,
    memory: MemoryExercise,
    quiz: QuizExercise,
    decision: DecisionExercise,
    sort: SortExercise,
    analysis: AnalysisExercise,
    cloze: ClozeExercise,
    test: TestExercise,
    listening: ListeningExercise,
    image: ImageExercise,
  }[exercise.type] || FillExercise;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      {/* combo toast */}
      {comboMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999]">
          <div className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-lg">
            {comboMsg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to={topic ? createPageUrl(`Exercises?topic=${topic.id}`) : createPageUrl('Home')}>
              <Button variant="ghost" size="sm" className="text-slate-600">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Zpět
              </Button>
            </Link>

            <div className="text-center">
              <h1 className="font-bold text-slate-800">{exercise.title}</h1>
              {topic && <p className="text-xs text-slate-500">{topic.name}</p>}
            </div>

            <div className="w-32 flex justify-end items-center gap-2">
              <Button
                variant="outline"
                size="md"
                className="border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 px-5 h-12 rounded-xl font-semibold"
                title="Ukončit cvičení"
                onClick={() => setShowEarlyExit(true)}
              >
                <CircleStop className="w-5 h-5 mr-2" />
                Ukončit cvičení
              </Button>

              {combo >= 2 ? (
                <div className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                  ⚡ {combo}×
                </div>
              ) : (
                <div className="w-6" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {exercise.instructions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 text-center"
          >
            <p className="text-slate-600">{exercise.instructions}</p>
          </motion.div>
        )}

        <ExerciseComponent
          exercise={exercise}
          onComplete={handleComplete}
          onStreak={onAnswerResult}
          onAnswerResult={onAnswerResult}
          onAttemptItem={onAttemptItem}
        />
      </div>

      {/* Modal: předčasné ukončení */}
      {showEarlyExit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowEarlyExit(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Předčasně ukončit cvičení?
            </h2>

            <p className="text-slate-600 mb-6">
              Nezodpovězené otázky se započítají jako špatně a hned uvidíš výsledek.
            </p>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="lg"
                className="px-4 h-8 rounded-xl border-2"
                onClick={() => setShowEarlyExit(false)}
              >
                Pokračovat
              </Button>

              <Button
                size="lg"
                className="px-4 h-8 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                onClick={() => {
                  setShowEarlyExit(false);
                  handleEarlyFinish();
                }}
              >
                Ukončit
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
