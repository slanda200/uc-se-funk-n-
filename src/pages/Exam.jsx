import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { BookOpen, Calculator, Globe, Trophy } from "lucide-react";

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * SEM doplníš skutečná Topic ID (z Base44 / DB)
 * - klíč = exam (Přijímačky / Maturita)
 * - pak 3 předměty
 */
const TOPIC_BY_EXAM_AND_SUBJECT = {
  "Přijímačky": {
    "Čeština": "topic_exam_pr_cz",
    "Matematika": "TOPIC_ID_PR_MAT",
    "Angličtina": "TOPIC_ID_PR_AJ",
  },
  "Maturita": {
    "Čeština": "TOPIC_ID_MAT_CZ",
    "Matematika": "TOPIC_ID_MAT_MAT",
    "Angličtina": "TOPIC_ID_MAT_AJ",
  },
};

const cards = [
  {
    name: "Čeština",
    icon: BookOpen,
    bg: "from-emerald-500 to-teal-600",
    desc: "Didakťák, gramatika, čtení",
  },
  {
    name: "Matematika",
    icon: Calculator,
    bg: "from-blue-500 to-indigo-600",
    desc: "Počty, slovní úlohy, geometrie",
  },
  {
    name: "Angličtina",
    icon: Globe,
    bg: "from-orange-500 to-amber-600",
    desc: "Slovíčka, gramatika, poslech",
  },
];

export default function Exam() {
  const exam = getParam("exam") || "Přijímačky";

  const topicMap = TOPIC_BY_EXAM_AND_SUBJECT[exam] || {};
  const hasAllTopics =
    !!topicMap["Čeština"] && !!topicMap["Matematika"] && !!topicMap["Angličtina"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-6 h-6 text-slate-700" />
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            {exam}
          </h1>
        </div>

        <p className="text-slate-600 mb-8">
          Vyber si předmět.
        </p>

        {!hasAllTopics && (
          <div className="mb-6 p-4 rounded-2xl bg-yellow-50 border border-yellow-200 text-yellow-900">
            <div className="font-semibold mb-1">Chybí Topic ID</div>
            <div className="text-sm">
              V souboru <code>Exam.jsx</code> doplň do{" "}
              <code>TOPIC_BY_EXAM_AND_SUBJECT</code> správná topic ID pro {exam}.
              Dokud tam budou placeholdery, klik povede na neexistující stránku.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {cards.map((c, idx) => {
            const Icon = c.icon;
            const topicId = topicMap[c.name];

            const link = topicId
              ? createPageUrl(`Categories?topic=${encodeURIComponent(topicId)}`)
              : createPageUrl(`Categories?topic=${encodeURIComponent("MISSING_TOPIC_ID")}`);

            return (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link to={link} className="block">
                  <div className={`rounded-3xl p-6 shadow-xl shadow-black/10 bg-gradient-to-br ${c.bg} relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-28 h-28 opacity-10">
                      <Icon className="w-full h-full" />
                    </div>
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-white text-2xl font-bold">{c.name}</div>
                      <div className="mt-2 text-white/80 text-sm">{c.desc}</div>

                      <div className="mt-4 text-white/90 text-sm font-medium">
                        Začít →
                      </div>
                    </div>
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
