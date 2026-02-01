// upravený index.ts s podporou gemini-1.5-flash a ručním ověřením tokenu
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });
const classifierModel = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonResponse = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // 🛡️ Ruční kontrola JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Unauthorized: Missing token" }, 401);
  }

  const token = authHeader.split(" ")[1];
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized: Invalid token" }, 401);
  }

  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "Invalid message" }, 400);
    }

    const systemInstruction = `
Jsi AI školní učitel. Pomáhej se školní látkou (matematika, čeština, angličtina atd.).
Neodpovídej na dotazy mimo školu. Pokud přijde takový dotaz, napiš: "Promiň, s tímto ti nemohu pomoci. Zeptej se mě raději na něco ze školy. 😊"
Odpovídej česky.
`;

    const isOutOfScope = (input: string) => {
      const keywords = ["ai", "umělá inteligence", "programování", "sex", "peníze", "politika", "deprese", "úzkost"];
      return keywords.some((word) => input.toLowerCase().includes(word));
    };

    if (isOutOfScope(message)) {
      return jsonResponse({
        reply: "Promiň, s tímto ti nemohu pomoci. Zeptej se mě raději na něco ze školy. 😊",
      });
    }

    const classificationPrompt = `
Dotaz: "${message}"
Je tento dotaz vhodný pro školního AI učitele?
Odpověz pouze objektem JSON:
{ "allowed": true } nebo { "allowed": false }
`;

    const classificationResult = await classifierModel.generateContent(classificationPrompt);
    const classificationText = await classificationResult.response.text();
    const isAllowed = classificationText.toLowerCase().includes('"allowed": true');

    if (!isAllowed) {
      return jsonResponse({
        reply: "Promiň, s tímto ti nemohu pomoci. Zeptej se mě raději na něco ze školy. 😊",
      });
    }

    const fullPrompt = [
      {
        role: "user",
        parts: [
          {
            text: `${systemInstruction}
${history.map((msg: any) => `${msg.role === "user" ? "Student" : "Učitel"}: ${msg.content}`).join("\n")}
Student: ${message}`,
          },
        ],
      },
    ];

    const result = await model.generateContent({ contents: fullPrompt });
    const text = result.response.text();

    return jsonResponse({ reply: text });
  } catch (e) {
    console.error("Chyba v AI odpovědi:", e);
    return jsonResponse({ error: "Nepodařilo se zpracovat zprávu." }, 500);
  }
});
