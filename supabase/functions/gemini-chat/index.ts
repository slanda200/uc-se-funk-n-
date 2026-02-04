// index.ts (fix: robust body parsing + JWT check + better Gemini errors + proper closing)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ChatMsg = { role: "user" | "assistant"; content: string };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ✅ env
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!apiKey) {
    return jsonResponse({ error: "Server misconfigured: GEMINI_API_KEY missing" }, 500);
  }
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse({ error: "Server misconfigured: SUPABASE_URL/ANON_KEY missing" }, 500);
  }

  // 🛡️ JWT check
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Unauthorized: Missing Bearer token" }, 401);
  }
  const token = authHeader.slice("bearer ".length).trim();
  if (!token) {
    return jsonResponse({ error: "Unauthorized: Empty token" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon);
  const { data: userData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !userData?.user) {
    return jsonResponse({ error: "Unauthorized: Invalid token" }, 401);
  }

  // ✅ parse body safely
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const message = body?.message;
  const historyRaw = body?.history;

  if (typeof message !== "string" || !message.trim()) {
    return jsonResponse({ error: "Invalid message" }, 400);
  }

  const history: ChatMsg[] = Array.isArray(historyRaw)
    ? historyRaw
        .slice(-30)
        .map((m: any) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: String(m?.content ?? ""),
        }))
    : [];

  // System prompt
  const systemInstruction = `
Jsi AI školní učitel. Pomáhej se školní látkou (matematika, čeština, angličtina atd.).
Neodpovídej na dotazy mimo školu. Pokud přijde takový dotaz, napiš:
"Promiň, s tímto ti nemohu pomoci. Zeptej se mě raději na něco ze školy. 😊"
Odpovídej česky.
`.trim();

  // ⚠️ jemný filtr (klidně si rozšiř)
  const isOutOfScope = (input: string) => {
    const keywords = ["sex", "politika"]; // "peníze" klidně vyhoď, kvůli slovním úlohám
    return keywords.some((w) => input.toLowerCase().includes(w));
  };

  if (isOutOfScope(message)) {
    return jsonResponse({
      reply: "Promiň, s tímto ti nemohu pomoci. Zeptej se mě raději na něco ze školy. 😊",
    });
  }

  // ✅ Gemini call
  const genAI = new GoogleGenerativeAI(apiKey);

  // Model: dej buď pevně, nebo přes env GEMINI_MODEL
  const modelName = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const transcript = history
      .map((msg) => `${msg.role === "user" ? "Student" : "Učitel"}: ${msg.content}`)
      .join("\n");

    const prompt = `${systemInstruction}
${transcript ? transcript + "\n" : ""}Student: ${message}
Učitel:`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim() ?? "";

    return jsonResponse({ reply: text || "Promiň, nepodařilo se mi vygenerovat odpověď. Zkus to prosím znovu." });
  } catch (e: any) {
    // ✅ lepší statusy (hlavně 429)
    const status = typeof e?.status === "number" ? e.status : 500;
    const msg = e instanceof Error ? e.message : String(e);

    console.error("Chyba v AI odpovědi:", e);

    if (status === 429 || String(msg).includes("429") || String(msg).toLowerCase().includes("quota")) {
      return jsonResponse(
        {
          error: "QUOTA_EXCEEDED",
          message:
            "AI je dočasně nedostupná kvůli limitům (quota). Zkus to prosím později, nebo zapni billing / použij jiný API key.",
        },
        429,
      );
    }

    return jsonResponse(
      {
        error: "AI_ERROR",
        message: msg,
      },
      500,
    );
  }
});
