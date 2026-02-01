import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Chybí Supabase env proměnné");
}

// ✅ HMR-safe singleton (zabrání víc instancím v dev)
const globalKey = "__eduup_supabase__";
const globalObj = globalThis;

export const supabase =
  globalObj[globalKey] ??
  (globalObj[globalKey] = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "eduup-auth",
    },
  }));
