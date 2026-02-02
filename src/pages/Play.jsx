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
// ✅ global question limiting
// ----------------------------
const DEFAULT_MAX_QUESTIONS = 12;

// ✅ default pro test generátor
const DEFAULT_TEST_QUESTIONS = 15;

// simple deterministic RNG (so order doesn't change on rerender)
function hashToSeed(str) {
  const s = String(str ?? "");
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDeterministic(arr, seedStr) {
  const out = [...arr];
  const rand = mulberry32(hashToSeed(seedStr));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getQuestionLimit(ex) {
  const raw =
    ex?.question_limit ??
    ex?.questions_limit ??
    ex?.max_questions ??
    ex?.maxQuestions ??
    ex?.limit_questions ??
    null;

  const n = typeof raw === "string" ? Number(raw) : raw;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_MAX_QUESTIONS;
}

// ✅ test limit (volitelné pole v test exercise)
function getTestQuestionLimit(ex) {
  const raw =
    ex?.test_question_limit ??
    ex?.test_questions_limit ??
    ex?.test_max_questions ??
    ex?.testMaxQuestions ??
    null;

  const n = typeof raw === "string" ? Number(raw) : raw;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_TEST_QUESTIONS;
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


function MixedTest({
  exercise,
  onComplete,
  onAttemptItem,
  onAnswerResult,
  onEarlyFinish,
}) {
  const questions = Array.isArray(exercise?.questions) ? exercise.questions : [];
  const total = questions.length;

  const [idx, setIdx] = React.useState(0);
  const [answer, setAnswer] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [isCorrect, setIsCorrect] = React.useState(false);
  const [correctCount, setCorrectCount] = React.useState(0);

  const q = questions[idx] || null;

  React.useEffect(() => {
    // reset input when switching question
    setAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
  }, [idx]);

  const normalize = (v) => String(v ?? '').trim().toLowerCase();

  const checkFill = (q, a) => {
    const ans = q?.answer;
    // podporujeme: string / {mode:'subset', items:[...]}
    if (typeof ans === 'string' || typeof ans === 'number') {
      return normalize(a) === normalize(ans);
    }
    if (ans && typeof ans === 'object' && ans.mode === 'subset' && Array.isArray(ans.items)) {
      return ans.items.map(normalize).includes(normalize(a));
    }
    return false;
  };

  const checkChoice = (q, a) => normalize(a) === normalize(q?.answer);

  const isFill = (q) => (q?.type || '').toLowerCase() === 'fill';
  const isChoice = (q) => {
    const t = (q?.type || '').toLowerCase();
    return t === 'quiz' || t === 'decision';
  };

  const getQuestionText = (q) => q?.question ?? q?.text ?? '';

  const getOptions = (q) => Array.isArray(q?.options) ? q.options : [];

  const handleSubmit = () => {
    if (!q) return;

    const t = (q.type || '').toLowerCase();
    const ok =
      t === 'fill' ? checkFill(q, answer) :
      (t === 'quiz' || t === 'decision') ? checkChoice(q, answer) :
      false;

    setSubmitted(true);
    setIsCorrect(ok);
    if (ok) setCorrectCount((c) => c + 1);

    // Attempt item -> pro AttemptReview
    onAttemptItem?.({
      exercise_id: exercise?.id,
      question_index: idx,
      type: t,
      correct: ok,
      user_answer: answer,
      expected_answer: q?.answer,
      explanation: q?.explanation ?? null,
    });

    onAnswerResult?.({ correct: ok, question_index: idx });
  };

  const handleNext = () => {
    if (idx + 1 >= total) {
      const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      onComplete?.({
        completed: true,
        score,
        correct: correctCount,
        total,
      });
      return;
    }
    setIdx((i) => i + 1);
  };

  const handleFinishEarly = () => {
    onEarlyFinish?.();
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    onComplete?.({
      completed: true,
      score,
      correct: correctCount,
      total,
      early_finish: true,
    });
  };

  if (!q) {
    return (
      <div className="bg-white rounded-2xl p-6 border">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Finální test</h2>
        <p className="text-slate-600">V tomhle testu nejsou žádné otázky.</p>
        <div className="mt-4">
          <Button onClick={handleFinishEarly}>Ukončit</Button>
        </div>
      </div>
    );
  }

  const options = getOptions(q);
  const t = (q.type || '').toLowerCase();
  const questionText = getQuestionText(q);

  return (
    <div className="bg-white rounded-2xl p-6 border shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="text-sm text-slate-500">
          Otázka {idx + 1} / {total}
        </div>
        <Button variant="outline" onClick={handleFinishEarly}>
          Ukončit test
        </Button>
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-2">{exercise?.title || 'Finální test'}</h2>
      {exercise?.instructions && (
        <p className="text-slate-600 mb-4">{exercise.instructions}</p>
      )}

      <div className="rounded-xl border bg-slate-50 p-4 mb-4">
        <div className="text-base font-semibold text-slate-800 whitespace-pre-wrap">
          {questionText}
        </div>
      </div>

      {/* Answer UI */}
      {isChoice(q) && (
        <div className="grid grid-cols-1 gap-2 mb-4">
          {options.map((opt) => {
            const selected = normalize(answer) === normalize(opt);
            return (
              <button
                key={String(opt)}
                type="button"
                onClick={() => !submitted && setAnswer(String(opt))}
                className={[
                  "text-left px-4 py-3 rounded-xl border transition",
                  selected ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-slate-300",
                  submitted ? "opacity-80 cursor-not-allowed" : ""
                ].join(" ")}
              >
                {String(opt)}
              </button>
            );
          })}
        </div>
      )}

      {isFill(q) && (
        <div className="mb-4">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Napiš odpověď…"
          />
        </div>
      )}

      {/* Controls */}
      {!submitted ? (
        <Button
          onClick={handleSubmit}
          disabled={String(answer).trim().length === 0}
          className="w-full"
        >
          Odeslat odpověď
        </Button>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 border ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="font-semibold text-slate-800">
              {isCorrect ? 'Správně ✅' : 'Špatně ❌'}
            </div>
            {q?.explanation && (
              <div className="text-slate-700 mt-2 whitespace-pre-wrap">{q.explanation}</div>
            )}
            {!isCorrect && (t === 'quiz' || t === 'decision' || t === 'fill') && (
              <div className="text-slate-600 mt-2">
                Správně: <span className="font-semibold text-slate-800">{typeof q.answer === 'object' ? 'viz zadání' : String(q.answer)}</span>
              </div>
            )}
          </div>

          <Button onClick={handleNext} className="w-full">
            {idx + 1 >= total ? 'Dokončit test' : 'Další otázka'}
          </Button>
        </div>
      )}

      <div className="mt-4 text-sm text-slate-500">
        Skóre: {correctCount} / {total}
      </div>
    </div>
  );
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

  // ✅ všechny úlohy v topicu (kvůli "Další úloha" + test generátor)
  const { data: scopeExercises = [] } = useQuery({
    queryKey: ['scopeExercises', exercise?.category_id || null, exercise?.topic_id || null],
    queryFn: async () => {
      // Preferuj kategorii, pokud existuje. Když není, fallback na topic.
      if (exercise?.category_id) {
        const list = await base44.entities.Exercise.filter({ category_id: exercise.category_id });
        return Array.isArray(list) ? list : [];
      }
      if (exercise?.topic_id) {
        const list = await base44.entities.Exercise.filter({ topic_id: exercise.topic_id });
        return Array.isArray(list) ? list : [];
      }
      return [];
    },
    enabled: !!exercise?.category_id || !!exercise?.topic_id,
  });

  // ✅ limit + shuffle questions globally + TEST generator
  const activeExercise = useMemo(() => {
    if (!exercise) return null;

    const seed = `${exerciseId}:${attemptIdRef.current || "seed"}`;

    const isTest = exercise?.is_test === true || exercise?.type === "test";

    // ✅ TEST: vezmi otázky z ostatních úloh v tématu se stejnou difficulty
    if (isTest) {
      // ✅ TEST: namixuj otázky jen z *této kategorie + obtížnosti*
      const testLimit = getTestQuestionLimit(exercise);

      // ⚠️ DŮLEŽITÉ: finální test dává smysl jen z typů, které umíme v testu zobrazit
      // (quiz/decision/fill). Ostatní typy (match/sort/analysis/cloze/...) by vyžadovaly speciální UI.
      const allowedTypes = new Set(['quiz', 'decision', 'fill']);

      const poolExercises = (scopeExercises || []).filter((ex2) =>
        !ex2?.is_test &&
        ex2?.difficulty === exercise?.difficulty &&
        allowedTypes.has(ex2?.type)
      );

      const poolQuestions = poolExercises.flatMap((ex2) =>
        (Array.isArray(ex2?.questions) ? ex2.questions : []).map((q, idx) => ({
          ...q,
          // ✅ aby bylo jasné, jaký renderer použít
          type: q?.type || ex2.type,
          _source_exercise_id: ex2.id,
          _source_question_index: idx,
        }))
      );

      const selected = shuffleDeterministic(poolQuestions, seed).slice(
        0,
        Math.min(poolQuestions.length, testLimit)
      );

      return { ...exercise, questions: selected };
    }

    // ✅ NORMAL: max 12 (nebo question_limit)
    const qs = Array.isArray(exercise?.questions) ? exercise.questions : [];
    const limit = Math.min(qs.length, getQuestionLimit(exercise));

    if (qs.length <= limit) return exercise;

    const shuffled = shuffleDeterministic(qs, seed).slice(0, limit);
    return { ...exercise, questions: shuffled };
  }, [exerciseId, exercise, scopeExercises]);

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
            console.error("❌ Nepodařilo se zapsat denní aktivitu:", error);
          } else {
            queryClient.invalidateQueries({ queryKey: ['dailyActivity'] });
          }
        }
      } catch (e) {
        console.error("❌ Chyba při zápisu denní aktivity:", e);
      }
    }
  };

  // ✅ FIX: handleEarlyFinish už nepoužívá `ex` dřív než existuje
  const handleEarlyFinish = () => {
    const exLocal = activeExercise || exercise;
    const questions = Array.isArray(exLocal?.questions) ? exLocal.questions : [];
    const total = questions.length || 1;

    const items = Array.isArray(attemptItemsRef.current) ? [...attemptItemsRef.current] : [];
    const answered = new Set(items.map((x) => x?.index).filter((v) => Number.isFinite(v)));

    for (let i = 0; i < total; i++) {
      if (answered.has(i)) continue;
      const q = questions[i] || null;
      const prompt = (q?.question ?? q?.text ?? q?.prompt ?? `Otázka ${i + 1}`).toString();

      items.push({
        index: i,
        type: exLocal?.type || 'exercise',
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
    dailyActivityGuardRef.current = { key: null };
  };

  const subjectColors = {
    'Matematika': { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50' },
    'Čeština': { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50' },
    'Angličtina': { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50' },
  };

  const colors = subjectColors[topic?.subject] || subjectColors['Matematika'];

  // ✅ doporučení další úlohy podle score + difficulty (1..3)
// pravidla:
// - difficulty 1: >=75% -> 2, jinak zůstat 1
// - difficulty 2: >=75% -> 3, 25–74% -> zůstat 2, <25% -> 1
// - difficulty 3: >=25% -> zůstat 3, <25% -> 2
  const recommendation = useMemo(() => {
    if (!isComplete || !result || !exercise) return null;

    const score = Number(result?.score ?? 0);
    const curType = exercise?.type || null;
    const curDiffRaw = getExerciseDifficulty(exercise);
    const curDiff = clampDifficulty(curDiffRaw ?? 1);

    const all = Array.isArray(scopeExercises) ? scopeExercises : [];
    const others = all.filter((e) => String(e?.id) !== String(exercise?.id));
    if (others.length === 0) return null;

    const pickRandom = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    };

    const byDiff = (d) => others.filter((e) => getExerciseDifficulty(e) === d);

    // 1) spočti cílovou obtížnost podle pravidel výše
    let targetDiff = curDiff;

    if (curDiff === 1) {
      targetDiff = score >= 75 ? 2 : 1;
    } else if (curDiff === 2) {
      if (score >= 75) targetDiff = 3;
      else if (score >= 25) targetDiff = 2;
      else targetDiff = 1;
    } else if (curDiff === 3) {
      targetDiff = score >= 25 ? 3 : 2;
    }

    // 2) vyber úlohu z cílové obtížnosti (preferuj stejný typ, když měníme obtížnost)
    const poolTarget = byDiff(targetDiff);

    let chosen = null;

    if (poolTarget.length > 0) {
      // pokud se obtížnost mění, preferuj stejný typ jako aktuální
      if (targetDiff !== curDiff && curType) {
        const sameTypePool = poolTarget.filter((e) => e?.type === curType);
        chosen = pickRandom(sameTypePool) || pickRandom(poolTarget);
      } else {
        // stejná obtížnost: preferuj jiný typ (když jde), jinak náhodně
        const diffTypePool = curType ? poolTarget.filter((e) => e?.type && e.type !== curType) : poolTarget;
        chosen = pickRandom(diffTypePool) || pickRandom(poolTarget);
      }
    }

    // 3) fallbacky (když v cílové obtížnosti nic není)
    if (!chosen) {
      // zkus stejnou obtížnost (jiné cvičení)
      const sameDiffPool = byDiff(curDiff);
      chosen = pickRandom(sameDiffPool) || pickRandom(others);
    }

    if (!chosen) return null;

    // 4) texty do UI
    const label =
      targetDiff > curDiff ? "Další cvičení (těžší)" :
      targetDiff < curDiff ? "Další cvičení (lehčí)" :
      "Další cvičení";

    const title =
      targetDiff > curDiff ? "Jdeš nahoru! 🔥" :
      targetDiff < curDiff ? "Zkusíme lehčí krok 🙂" :
      "Ještě jedno na procvičení 💪";

    const text =
      targetDiff > curDiff ? "Máš super výsledek – zkus těžší úroveň ve stejné kategorii." :
      targetDiff < curDiff ? "Tohle bylo těžší – dáme lehčí úroveň ve stejné kategorii." :
      "Zůstaneme na stejné obtížnosti a dáme jiné cvičení.";

    return {
      title,
      text,
      button: label,
      exercise: chosen,
    };
  }, [isComplete, result, exercise, scopeExercises]);

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

  const ex = activeExercise || exercise;

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

          <p className="text-slate-500 mb-6">{ex.title}</p>

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

            {!recommendation?.exercise?.id && (
              <Button onClick={handleRetry} className={`h-14 text-lg rounded-2xl bg-gradient-to-r ${colors.gradient}`}>
                <RotateCcw className="w-5 h-5 mr-2" />
                Zkusit znovu
              </Button>
            )}

            <Link to={topic ? createPageUrl(`Exercises?topic=${topic.id}${exercise?.category_id ? `&category=${exercise.category_id}` : ''}`) : createPageUrl('Home')} className="w-full">
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
    test: MixedTest,
    listening: ListeningExercise,
    image: ImageExercise,
  }[ex.type] || FillExercise;

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
            <Link to={topic ? createPageUrl(`Exercises?topic=${topic.id}${exercise?.category_id ? `&category=${exercise.category_id}` : ''}`) : createPageUrl('Home')}>
              <Button variant="ghost" size="sm" className="text-slate-600">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Zpět
              </Button>
            </Link>

            <div className="text-center">
              <h1 className="font-bold text-slate-800">{ex.title}</h1>
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
        {ex.instructions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-6 text-center"
          >
            <p className="text-slate-600">{ex.instructions}</p>
          </motion.div>
        )}

        <ExerciseComponent
          exercise={ex}
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
