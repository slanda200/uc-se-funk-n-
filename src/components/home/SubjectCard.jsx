import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import {
  Calculator,
  BookOpen,
  Globe,
  Keyboard,
  GraduationCap,
  Trophy,
} from 'lucide-react';

const icons = {
  Calculator,
  BookOpen,
  Globe,
  Keyboard,

  // exam ikony (lucide)
  GraduationCap,
  Trophy,
};

export default function SubjectCard({ subject, index }) {
  const Icon = icons[subject.icon] || BookOpen;

  // ✅ barvy ber podle subject.color (co máš v subject.json / DB),
  // a fallback podle názvu
  const colorByName = {
    Matematika: 'from-blue-500 to-indigo-600',
    Čeština: 'from-emerald-500 to-teal-600',
    Angličtina: 'from-orange-500 to-amber-600',
    Psaní: 'from-purple-500 to-violet-600',

    Přijímačky: 'from-amber-500 to-orange-600',
    Maturita: 'from-yellow-500 to-amber-600',
  };

  const gradientByColor = {
    // pokud v datech používáš "amber", "rose", ...
    amber: 'from-amber-500 to-orange-600',
    rose: 'from-rose-500 to-pink-600',
    yellow: 'from-yellow-500 to-amber-600',
    blue: 'from-blue-500 to-indigo-600',
    emerald: 'from-emerald-500 to-teal-600',
    orange: 'from-orange-500 to-amber-600',
    purple: 'from-purple-500 to-violet-600',
    slate: 'from-slate-600 to-slate-800',
  };

  const bg =
    gradientByColor[String(subject.color || '').toLowerCase()] ||
    colorByName[subject.name] ||
    colorByName['Matematika'];

  // ✅ POPISY
  const descByName = {
    Matematika: 'Počítání, geometrie a logika',
    Čeština: 'Čtení, psaní a gramatika',
    Angličtina: 'Slovíčka a konverzace',
    Psaní: 'Rychlé psaní na klávesnici',

    Přijímačky: 'Shrnutí a trénink na testy',
    Maturita: 'Finální příprava na maturitu',
  };

  // ✅ KLÍČ: jiný link pro exams
  const isExam = subject.group === 'exam';

  const link = isExam
    ? createPageUrl(`Exam?exam=${encodeURIComponent(subject.name)}`)
    : createPageUrl(`Grades?subject=${encodeURIComponent(subject.name)}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={link} className="block">
        <div
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bg} p-6 md:p-8 shadow-xl shadow-black/10 cursor-pointer group`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 md:w-40 md:h-40 opacity-10">
            <Icon className="w-full h-full" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
              <Icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>

            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {subject.name}
            </h3>

            <p className="text-white/80 text-sm md:text-base">
              {descByName[subject.name] || 'Začni procvičovat'}
            </p>

            <div className="mt-4 flex items-center gap-2 text-white/90 text-sm font-medium group-hover:translate-x-1 transition-transform">
              <span>{isExam ? 'Začít přípravu' : 'Začít se učit'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
