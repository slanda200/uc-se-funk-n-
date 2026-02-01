import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Languages,
  Search,
  Info,
  Play
} from "lucide-react";

const SUBJECTS = [
  {
    key: "Čeština",
    title: "Čeština",
    icon: BookOpen,
    gradient: "from-emerald-500 to-teal-600",
    light: "bg-emerald-100",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  {
    key: "Matematika",
    title: "Matematika",
    icon: Calculator,
    gradient: "from-blue-500 to-indigo-600",
    light: "bg-blue-100",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
  {
    key: "Angličtina",
    title: "Angličtina",
    icon: Languages,
    gradient: "from-orange-500 to-amber-600",
    light: "bg-orange-100",
    text: "text-orange-700",
    bg: "bg-orange-50",
  },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function Library() {
  const navigate = useNavigate();

  // ✅ URL params (grade default 1)
  const urlParams = new URLSearchParams(window.location.search);
  const gradeRaw = urlParams.get("grade");
  const grade = clamp(Number(gradeRaw || 1) || 1, 1, 9);

  const [query, setQuery] = React.useState("");

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ["libraryTopics", grade],
    queryFn: async () => {
      const list = await base44.entities.Topic.filter({ grade }, "order");
      return Array.isArray(list) ? list : [];
    },
  });

  const grouped = React.useMemo(() => {
    const by = new Map();
    for (const s of SUBJECTS) by.set(s.key, []);
    for (const t of topics) {
      const key = t?.subject || "Čeština";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(t);
    }

    for (const [, arr] of by.entries()) {
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return by;
  }, [topics]);

  const filteredTopics = React.useCallback(
    (subjectKey) => {
      const arr = grouped.get(subjectKey) || [];
      const q = query.trim().toLowerCase();
      if (!q) return arr;

      return arr.filter((t) => {
        const name = String(t?.name || "").toLowerCase();
        // description už nezobrazujeme, ale v hledání ji klidně necháme (je to užitečný)
        const desc = String(t?.description || "").toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    },
    [grouped, query]
  );

  const setGradeInUrl = (nextGrade) => {
    const params = new URLSearchParams(window.location.search);
    params.set("grade", String(nextGrade));
    navigate(`${createPageUrl("Library")}?${params.toString()}`);
  };

  const goToTopicExplanation = (topicId) => {
    const backUrl = encodeURIComponent(`${createPageUrl("Library")}?grade=${grade}`);
    navigate(`/TopicExplanation?topic=${topicId}&back=${backUrl}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link to={createPageUrl("Home")}>
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Domů
              </Button>
            </Link>

            <div className="text-center">
              <div className="text-xl font-extrabold text-slate-800"> Knihovna učiva</div>
              <div className="text-sm text-slate-500">
                Vyber předmět a čti vysvětlení témat (styl „učebnice“).
              </div>
            </div>

            <div className="w-20" />
          </div>

          {/* Controls row */}
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            {/* Grade selector */}
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-700">Třída:</div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
                  <Button
                    key={g}
                    variant={g === grade ? "default" : "outline"}
                    className="h-10 px-3 rounded-2xl"
                    onClick={() => setGradeInUrl(g)}
                  >
                    {g}.
                  </Button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-[380px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat téma… (např. vyjmenovaná slova)"
                className="w-full h-12 pl-10 pr-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-slate-100 animate-pulse"
              >
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              const list = filteredTopics(s.key);
              const total = (grouped.get(s.key) || []).length;

              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  {/* Subject header */}
                  <div className={`p-5 bg-gradient-to-r ${s.gradient} text-white`}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-xl font-extrabold">{s.title}</div>
                        <div className="text-white/80 text-sm">
                          {total} témat • {grade}. třída
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Always open list */}
                  <div className="p-4">
                    {list.length === 0 ? (
                      <div className={`rounded-2xl ${s.bg} border border-slate-100 p-4 text-slate-700`}>
                        <div className="font-bold mb-1 text-sm">Nic nenalezeno</div>
                        <div className="text-xs text-slate-600">
                          Zkus jiný název nebo vymaž hledání.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {list.map((t) => (
                          <div
                            key={t.id}
                            className="rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition p-4"
                          >
                            {/* ✅ min-w-0 aby text nepřetlačil tlačítka */}
                            <div className="flex items-start justify-between gap-4">
                              {/* Text (jen nadpis) */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={`w-9 h-9 rounded-xl ${s.light} flex items-center justify-center`}>
                                    <Info className={`w-5 h-5 ${s.text}`} />
                                  </div>

                                  {/* ✅ truncate => dlouhé názvy nerozbijí layout */}
                                  <div className="font-extrabold text-slate-800 text-[13px] leading-5 truncate">
                                    {t.name}
                                  </div>
                                </div>
                              </div>

                              {/* Buttons (menší, ale pořád pohodlné) */}
                              <div className="flex flex-col gap-3 shrink-0 w-[128px]">
                                <Button
                                  className="h-10 rounded-2xl text-[14px] font-bold"
                                  onClick={() => goToTopicExplanation(t.id)}
                                >
                                  Číst
                                </Button>

                                <Link to={createPageUrl(`Exercises?topic=${t.id}`)}>
                                  <Button
                                    variant="outline"
                                    className="h-10 rounded-2xl text-[14px] font-bold w-full border-2"
                                  >
                                    <Play className="w-5 h-5 mr-2" />
                                    Cvičení
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Library;
