import { supabase } from "@/lib/supabaseClient";

export async function upsertProgress({
  exerciseId,
  score = 0,
  stars = 0,
  completed = true,
}) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) return { skipped: true, reason: "not_logged_in" };
  if (!exerciseId) return { skipped: true, reason: "missing_exerciseId" };

  // načti existující řádek (kvůli attempts a best hodnotám + zda už bylo completed)
  const { data: existing, error: selErr } = await supabase
    .from("user_progress")
    .select("id, attempts, best_score, best_stars, completed")
    .eq("user_id", user.id)
    .eq("exercise_id", String(exerciseId))
    .maybeSingle();

  if (selErr) throw selErr;

  const nextAttempts = (existing?.attempts ?? 0) + 1;
  const nextBestScore = Math.max(existing?.best_score ?? 0, Number(score) || 0);
  const nextBestStars = Math.max(existing?.best_stars ?? 0, Number(stars) || 0);

  // ✅ zjistíme, jestli tohle volání právě způsobí "první dokončení"
  // (když už bylo completed dřív, streak už nepřidáváme kvůli farmení)
  const wasCompletedBefore = !!existing?.completed;
  const willBeCompletedNow = !!completed || wasCompletedBefore;
  const firstTimeCompletedNow = !!completed && !wasCompletedBefore;

  // upsert: používáme best_score / best_stars (správné názvy sloupců)
  const { data, error } = await supabase
    .from("user_progress")
    .upsert(
      {
        user_id: user.id,
        exercise_id: String(exerciseId),
        completed: willBeCompletedNow,
        attempts: nextAttempts,
        best_score: nextBestScore,
        best_stars: nextBestStars,
        last_played_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exercise_id" }
    )
    .select()
    .maybeSingle();

  if (error) throw error;

  // ✅ DAILY STREAK: bumpni jen když uživatel poprvé dokončil toto cvičení
  // (streak se stejně počítá jen 1x za den, ale tímhle zamezíš spamování)
  if (firstTimeCompletedNow) {
    const { error: streakErr } = await supabase.rpc("bump_streak");
    // streak chyba nesmí zrušit uložení progresu
    if (streakErr) {
      console.warn("bump_streak failed:", streakErr);
    }
  }

  return data;
}

export async function fetchMyProgress() {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id);

  if (error) throw error;
  return data ?? [];
}
