import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Trophy, Star, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function rankBadge(rank) {
  if (rank === 1) return { icon: Medal, label: "1", cls: "text-yellow-600" };
  if (rank === 2) return { icon: Medal, label: "2", cls: "text-slate-500" };
  if (rank === 3) return { icon: Medal, label: "3", cls: "text-amber-700" };
  return { icon: null, label: String(rank), cls: "text-slate-500" };
}

export default function Leaderboard() {
  const [limit, setLimit] = React.useState(10); // můžeš přepnout na 100

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["leaderboardStars", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_stars")
        .select("user_id, username, total_stars, completed_count, last_active")
        .order("total_stars", { ascending: false })
        .order("completed_count", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl("Home")}>
          <Button variant="ghost" className="mb-6 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Zpět
          </Button>
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="w-7 h-7 text-yellow-500" />
                Leaderboard
              </h1>
              <p className="text-slate-500">Top uživatelé podle celkových hvězdiček.</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={limit === 10 ? "default" : "outline"}
                onClick={() => setLimit(10)}
                className="px-6 py-3 rounded-xl text-base font-semibold"
              >
                Top 10
              </Button>
              <Button
                variant={limit === 100 ? "default" : "outline"}
                onClick={() => setLimit(100)}
                className="px-6 py-3 rounded-xl text-base font-semibold"
              >
                Top 100
              </Button>
            </div>
          </div>
        </motion.div>

        <Card className="rounded-3xl shadow-md">
          <CardHeader>
            <CardTitle className="text-slate-800">Žebříček</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-slate-500">Načítám…</div>
            ) : error ? (
              <div className="text-red-600">Chyba při načítání leaderboardu.</div>
            ) : rows.length === 0 ? (
              <div className="text-slate-500">Zatím tu nejsou žádná data.</div>
            ) : (
              <div className="space-y-2">
                {rows.map((r, idx) => {
                  const rank = idx + 1;
                  const b = rankBadge(rank);
                  const MedalIcon = b.icon;

                  return (
                    <div
                      key={r.user_id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 flex items-center justify-center font-bold ${b.cls}`}>
                          {MedalIcon ? <MedalIcon className="w-5 h-5" /> : b.label}
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">
                            {r.username}
                          </div>
                          <div className="text-xs text-slate-500">
                            Dokončeno: {r.completed_count ?? 0}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span>{r.total_stars ?? 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
