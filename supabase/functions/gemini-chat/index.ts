// index.ts (fix: robust body parsing + history default + model id + clearer errors)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ✅ sanity check env
  if (!apiKey) return jsonResponse({ error: "Server misconfigured: GEMINI_API_KEY missing" }, 500);
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse({ error: "Server misconfigured: SUPABASE_URL/ANON_KEY missing" }, 500);
  }

  // 🛡️ Ruční kontrola JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Unauthorized: Missing token" }, 401);
  }

  const token = authHeader.split(" ")[1];

  const supabase = createClient(supabaseUrl, supabaseAnon);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
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

  if (!message || typeof message !== "string") {
    return jsonResponse({ error: "Invalid message" }, 400);
  }

  const history = Array.isArray(historyRaw)
    ? historyRaw
        .slice(-30)
        .map((m: any) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: String(m?.content ?? ""),
        }))
    : [];

  const genAI = new GoogleGenerativeAI(apiKey);
  // ✅ use model id without "models/"
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const systemInstruction = `
Jsi AI školní učitel. Pomáhej se školní látkou (matematika, čeština, angličtina atd.).
Neodpovídej na dotazy mimo školu. Pokud přijde takový dotaz, napiš: "Promiň, s tímto ti nemohu pomoci. Zeptej se mě raději na něco ze školy. 😊"
Odpovídej česky.
`;

  // ⚠️ méně agresivní filtr – ať to neblokuje školní IT dotazy jen kvůli slovu "ai"
  const isOutOfScope = (input: string) => {
    const keywords = ["sex", "peníze", "politika"];
    return keywords.some((word) => input.toLowerCase().includes(word));
  };

  if (isOutOfScope(message)) {
    return jsonResponse({
      reply: "Promiň, s tímto ti nemohu pomoci. Zeptej se mě raději na něco ze školy. 😊",
    });
  }

  try {
    const transcript = history
      .map((msg: any) => `${msg.role === "user" ? "Student" : "Učitel"}: ${msg.content}`)
      .join("\n");

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `${systemInstruction}
${transcript}
Student: ${message}`,
          },
        ],
      },
    ];

    const result = await model.generateContent({ contents });
    const text = result.response.text();

    return jsonResponse({ reply: text });
  } catch (e) {
    console.error("Chyba v AI odpovědi:", e);
    // ✅ vrať i stručný detail do body (pomůže debug)
    return jsonResponse(
      { error: "Nepodařilo se zpracovat zprávu.", detail: String(e?.message ?? e) },
      500,
    );
  }
});
