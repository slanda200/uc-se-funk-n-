import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Library } from "lucide-react";
import { motion } from "framer-motion";

const subjectColors = {
  Matematika: { gradient: "from-blue-500 to-indigo-600", bg: "bg-blue-50" },
  Čeština: { gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-50" },
  Angličtina: { gradient: "from-orange-500 to-amber-600", bg: "bg-orange-50" },
};

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function inferBackLabel(backUrl) {
  const u = String(backUrl || "").toLowerCase();
  if (u.includes("/exercises") || u.includes("exercises")) return "Zpět na cvičení";
  if (u.includes("/library") || u.includes("library")) return "Zpět do knihovny";
  return "Zpět";
}

function TopicExplanation() {
  const urlParams = new URLSearchParams(window.location.search);
  const topicId = urlParams.get("topic");
  const backRaw = urlParams.get("back");

  const backUrl = backRaw
    ? safeDecode(backRaw)
    : null;

  const backLabel = inferBackLabel(backUrl);

  const { data: topic, isLoading } = useQuery({
    queryKey: ["topic", topicId],
    queryFn: async () => {
      const list = await base44.entities.Topic.filter({ id: topicId });
      return list[0];
    },
    enabled: !!topicId,
  });

  const colors = subjectColors[topic?.subject] || subjectColors.Matematika;

  // fallback když back není:
  const fallbackBack = topic
    ? createPageUrl(`Categories?topic=${topic.id}`)
    : createPageUrl("Home");

  const finalBackUrl = backUrl || fallbackBack;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 ${colors.bg} to-white`}>
      <div className={`bg-gradient-to-r ${colors.gradient} text-white`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={finalBackUrl}>
            <Button variant="ghost" className="mb-4 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5 mr-2" />
              {backLabel}
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {topic?.name || "Vysvětlení tématu"}
                </h1>
                {topic && (
                  <p className="text-white/80">
                    {topic.subject} • {topic.grade}. třída
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-3" />
            <div className="h-4 bg-slate-100 rounded w-2/3 mb-2" />
            <div className="h-4 bg-slate-100 rounded w-1/2" />
          </div>
        ) : !topic ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
            <div className="text-xl font-bold text-slate-800 mb-2">Téma nenalezeno</div>
            <Link to={createPageUrl("Home")}>
              <Button>Domů</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm">
            {topic.description && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 mb-6">
                <div className="text-xs uppercase tracking-wide text-blue-700/70 mb-1">
                  Stručně
                </div>
                <div className="text-slate-700">{topic.description}</div>
              </div>
            )}

            <div className="prose prose-slate max-w-none">
              <h2>Celé vysvětlení</h2>

              {topic.explanation ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{topic.explanation}</div>
              ) : (
                <div className="text-slate-600">
                  Tohle téma zatím nemá vyplněné pole <b>explanation</b>.
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to={createPageUrl(`Exercises?topic=${topic.id}`)} className="flex-1">
                <Button className="w-full h-12 rounded-2xl">Jít na cvičení</Button>
              </Link>

              <Link to={finalBackUrl} className="flex-1">
                <Button variant="outline" className="w-full h-12 rounded-2xl border-2">
                  {backLabel}
                </Button>
              </Link>

              {/* volitelně rychlá cesta do knihovny, když back není z knihovny */}
              {!String(finalBackUrl).toLowerCase().includes("library") && (
                <Link to={createPageUrl("Library")} className="flex-1">
                  <Button variant="outline" className="w-full h-12 rounded-2xl border-2">
                    <Library className="w-5 h-5 mr-2" />
                    Knihovna
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TopicExplanation;
