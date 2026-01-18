import React from 'react';
import { motion } from 'framer-motion';
import { Star, Trophy, Flame, Target } from 'lucide-react';

export default function StatsCard({ progress }) {
  const totalStars = progress.reduce((sum, p) => sum + (p.stars || 0), 0);
  const completedCount = progress.filter(p => p.completed).length;
  
  const stats = [
    { 
      icon: Star, 
      value: totalStars, 
      label: 'Hvězdiček', 
      color: 'text-yellow-500',
      bg: 'bg-yellow-50'
    },
    { 
      icon: Trophy, 
      value: completedCount, 
      label: 'Splněných cvičení', 
      color: 'text-emerald-500',
      bg: 'bg-emerald-50'
    },
    { 
      icon: Flame, 
      value: Math.round(progress.reduce((sum, p) => sum + (p.score || 0), 0) / Math.max(progress.length, 1)), 
      label: 'Průměrné skóre %', 
      color: 'text-orange-500',
      bg: 'bg-orange-50'
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + index * 0.1 }}
          className={`${stat.bg} rounded-2xl p-4 md:p-5 text-center`}
        >
          <stat.icon className={`w-6 h-6 md:w-8 md:h-8 ${stat.color} mx-auto mb-2`} />
          <div className={`text-2xl md:text-3xl font-bold ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-xs md:text-sm text-slate-600 mt-1">
            {stat.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}