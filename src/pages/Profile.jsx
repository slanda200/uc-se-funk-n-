import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, User, Mail, Star, Trophy, TrendingUp, TrendingDown, Calendar, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export default function Profile() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ['allExercises'],
    queryFn: () => base44.entities.Exercise.list(),
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['allTopics'],
    queryFn: () => base44.entities.Topic.list(),
  });

  // Calculate statistics by subject
  const getSubjectStats = (subjectName) => {
    const subjectTopics = topics.filter(t => t.subject === subjectName);
    const subjectTopicIds = subjectTopics.map(t => t.id);
    const subjectExercises = exercises.filter(e => subjectTopicIds.includes(e.topic_id));
    const subjectProgress = progress.filter(p => 
      subjectExercises.some(e => e.id === p.exercise_id)
    );

    const completed = subjectProgress.filter(p => p.completed).length;
    const totalExercises = subjectExercises.length;
    const avgScore = subjectProgress.length > 0 
      ? Math.round(subjectProgress.reduce((sum, p) => sum + (p.score || 0), 0) / subjectProgress.length)
      : 0;
    const totalStars = subjectProgress.reduce((sum, p) => sum + (p.stars || 0), 0);
    const maxStars = completed * 3;

    // Find weakest topics
    const topicPerformance = subjectTopics.map(topic => {
      const topicExercises = exercises.filter(e => e.topic_id === topic.id);
      const topicProgress = progress.filter(p => 
        topicExercises.some(e => e.id === p.exercise_id)
      );
      const topicAvg = topicProgress.length > 0
        ? topicProgress.reduce((sum, p) => sum + (p.score || 0), 0) / topicProgress.length
        : 0;
      
      return { topic, avgScore: topicAvg, count: topicProgress.length };
    }).filter(t => t.count > 0).sort((a, b) => a.avgScore - b.avgScore);

    return {
      completed,
      totalExercises,
      avgScore,
      totalStars,
      maxStars,
      completionRate: totalExercises > 0 ? Math.round((completed / totalExercises) * 100) : 0,
      weakestTopics: topicPerformance.slice(0, 3),
      strongestTopics: topicPerformance.slice(-3).reverse()
    };
  };

  const subjects = ['Čeština', 'Angličtina', 'Matematika'];
  const subjectColors = {
    'Čeština': { bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-600' },
    'Angličtina': { bg: 'bg-orange-50', text: 'text-orange-600', gradient: 'from-orange-500 to-amber-600' },
    'Matematika': { bg: 'bg-blue-50', text: 'text-blue-600', gradient: 'from-blue-500 to-indigo-600' }
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (password) => {
      // This would need backend implementation
      throw new Error('Změna hesla není v této verzi podporována');
    },
    onSuccess: () => {
      toast.success('Heslo bylo změněno');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleChangePassword = () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Vyplňte obě pole');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Hesla se neshodují');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Heslo musí mít alespoň 6 znaků');
      return;
    }
    changePasswordMutation.mutate(newPassword);
  };

  if (!user) return null;

  const totalCompleted = progress.filter(p => p.completed).length;
  const totalStars = progress.reduce((sum, p) => sum + (p.stars || 0), 0);
  const overallAvg = progress.length > 0
    ? Math.round(progress.reduce((sum, p) => sum + (p.score || 0), 0) / progress.length)
    : 0;

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-3xl text-white font-bold">
                {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">{user.full_name || 'Uživatel'}</h1>
              <p className="text-slate-500 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        </motion.div>

        {/* Subject Performance */}
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
                        <span className={`text-2xl font-bold ${colors.text}`}>
                          {stats.avgScore}%
                        </span>
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

                      {/* Weakest topics */}
                      {stats.weakestTopics.length > 0 && (
                        <div className="border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            Kde můžeš zlepšit
                          </div>
                          <div className="space-y-2">
                            {stats.weakestTopics.map((item, idx) => (
                              <Link 
                                key={idx}
                                to={createPageUrl(`Exercises?topic=${item.topic.id}`)}
                                className="block"
                              >
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

                      {/* Strongest topics */}
                      {stats.strongestTopics.length > 0 && (
                        <div className="border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Tvoje silné stránky
                          </div>
                          <div className="space-y-2">
                            {stats.strongestTopics.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50">
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{item.topic.name}</div>
                                  <div className="text-xs text-slate-500">{item.topic.grade}. třída</div>
                                </div>
                                <div className="text-sm font-medium text-emerald-600">
                                  {Math.round(item.avgScore)}%
                                </div>
                              </div>
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

        {/* Change Password */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Změna hesla
              </CardTitle>
              <CardDescription>
                Aktualizujte své heslo pro lepší zabezpečení
              </CardDescription>
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
                
                <Button 
                  onClick={handleChangePassword}
                  disabled
                  className="w-full"
                >
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