import { supabase } from "@/lib/supabaseClient";

const normalizeId = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
};

const mapRowToExercise = (row) => {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  return {
    id: row.id,
    created_at: row.created_at,
    created_by: row.created_by,
    topic_id: row.topic_id ?? null,
    category_id: row.category_id ?? null,
    type: row.type,
    title: row.title,
    instructions: row.instructions ?? null,
    ...payload, // stejné rozbalení jako v Exercises.jsx
  };
};

export async function listSupabaseExercises({ topicId, categoryId }) {
  const tId = normalizeId(topicId);
  const cId = normalizeId(categoryId);

  if (!tId) return [];

  let q = supabase
    .from("exercises")
    .select("id, created_at, created_by, topic_id, category_id, type, title, instructions, payload")
    .eq("topic_id", tId);

  // ✅ Fix: NE truthy check – musí se rozlišit null vs "" vs "null"
  if (cId !== null) q = q.eq("category_id", cId);
  else q = q.is("category_id", null);

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map(mapRowToExercise);
}

export { normalizeId };
