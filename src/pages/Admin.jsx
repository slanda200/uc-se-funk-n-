import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import topicsData from "@/data/base44/topic.json";
import categoriesData from "@/data/base44/category.json";

/**
 * ✅ Typy co reálně používáš v Play.jsx:
 * fill, match, memory, quiz, decision, sort, analysis, cloze, listening, image, test
 */
const EXERCISE_TYPES = [
  { value: "fill", label: "Vpisování (fill)" },
  { value: "match", label: "Spojování / Párování (match)" },
  { value: "memory", label: "Pexeso (memory)" },
  { value: "quiz", label: "Otázky (quiz)" },
  { value: "decision", label: "Rozhodovačka (decision)" },
  { value: "sort", label: "Rozřazovačka (sort)" },
  { value: "analysis", label: "Rozbory (analysis)" },
  { value: "cloze", label: "Doplňování textu (cloze)" },
  { value: "listening", label: "Poslech a psaní (listening)" },
  { value: "image", label: "Obrázek a psaní (image)" },
  { value: "test", label: "Finální test (test)" },
];

// ✅ šablony payloadu – aby admin nemusel začínat od nuly
export function templateFor(type) {
  switch (type) {
    case "decision":
    case "quiz":
      return {
        questions: [
          {
            question: "Otázka…",
            options: ["A", "B", "C"],
            answer: "A",
            explanation: "",
          },
        ],
      };

    case "fill":
      return {
        questions: [
          {
            question: "Doplň slovo: ___",
            answer: "správná odpověď",
            explanation: "",
          },
        ],
      };

    case "cloze":
      return {
        text: "Doplň chybějící slova v textu…",
        questions: [
          {
            question: "Věta: Mám rád ___.",
            answer: "čokoládu",
            explanation: "",
          },
        ],
      };

    case "match":
      return {
        instructions_hint: "Páruj správné dvojice.",
        pairs: [
          { left: "Pes", right: "Dog", explanation: "" },
          { left: "Kočka", right: "Cat", explanation: "" },
        ],
      };

    case "memory":
      // explanation je tady na každé kartě (může zůstat prázdné)
      return {
        cards: [
          { id: "1a", value: "A", explanation: "" },
          { id: "1b", value: "A", explanation: "" },
          { id: "2a", value: "B", explanation: "" },
          { id: "2b", value: "B", explanation: "" },
        ],
      };

    case "sort":
      return {
        categories: ["Samohlásky", "Souhlásky"],
        items: [
          { text: "A", category: "Samohlásky", explanation: "" },
          { text: "K", category: "Souhlásky", explanation: "" },
        ],
      };

    case "analysis":
      // ✅ Legend potřebuje 2 barvy: red & blue (podle tvého screenshotu)
      // ✅ Klikací segmenty bereme jako words: [{ word, color }]
      return {
        legend: {
          red: "Co znamená červená (red)…",
          blue: "Co znamená modrá (blue)…",
        },
        text: "Text k rozboru…",
        questions: [
          {
            question: "Najdi epizeuxis.",
            words: [
              // ukázka: systém to bude generovat z věty po slovech (mezera = segment)
              // { word: "Najdi", color: "blue" },
              // { word: "epizeuxis", color: "red" },
            ],
            answer: "…",
            explanation: "",
          },
        ],
      };

    case "listening":
      return {
        audio_url: null,
        text: "Co slyšíš? Přepiš větu…",
        questions: [{ question: "Napiš přesně větu z poslechu.", answer: "…", explanation: "" }],
      };

    case "image":
      return {
        image_url: null,
        text: "Podívej se na obrázek a napiš odpověď…",
        questions: [{ question: "Co je na obrázku?", answer: "…", explanation: "" }],
      };

    case "test":
      return {
        note: "Test se může generovat automaticky v Play.jsx (mix otázek z tématu).",
        questions: [
          // i kdyby prázdné, držíme strukturu s explanation
          // { question: "...", answer: "...", explanation: "" }
        ],
        explanation: "",
      };

    default:
      return { questions: [{ question: "", answer: "", explanation: "" }] };
  }
}

function toJsonText(obj) {
  return JSON.stringify(obj, null, 2);
}

// ===============================
// ✅ UNIVERSAL PAYLOAD BUILDER (formulář z JSON)
// + SPECIAL CASE pro analysis (legend red/blue + words segmenty)
// ===============================
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function guessNewItemFromExample(example) {
  if (Array.isArray(example)) return [];
  if (isPlainObject(example)) {
    const out = {};
    for (const k of Object.keys(example)) out[k] = guessNewItemFromExample(example[k]);
    return out;
  }
  if (typeof example === "string") return "";
  if (typeof example === "number") return 0;
  if (typeof example === "boolean") return false;
  return null;
}

function InputPrimitive({ value, onChange }) {
  const [isNull, setIsNull] = useState(value === null);

  useEffect(() => setIsNull(value === null), [value]);

  if (isNull) {
    return (
      <div className="flex gap-2 items-center">
        <input value={"null"} disabled className="w-full rounded-xl border px-3 py-2 bg-slate-50" />
        <button
          type="button"
          onClick={() => {
            setIsNull(false);
            onChange("");
          }}
          className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
        >
          Nastavit
        </button>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-sm text-slate-700">{value ? "true" : "false"}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-auto px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
        >
          null
        </button>
      </label>
    );
  }

  const isNumber = typeof value === "number";
  return (
    <div className="flex gap-2 items-center">
      <input
        type={isNumber ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(isNumber ? (raw === "" ? 0 : Number(raw)) : raw);
        }}
        className="w-full rounded-xl border px-3 py-2"
      />
      <button
        type="button"
        onClick={() => onChange(null)}
        className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
      >
        null
      </button>
    </div>
  );
}

function JsonForm({ value, onChange }) {
  // Primitive
  if (value === null || typeof value !== "object") {
    return <InputPrimitive value={value} onChange={onChange} />;
  }

  // Array
  if (Array.isArray(value)) {
    const arr = value;
    const example = arr[0] ?? ""; // když je prázdný, uděláme default string
    const addItem = () => {
      const next = clone(arr);
      next.push(guessNewItemFromExample(example));
      onChange(next);
    };

    return (
      <div className="space-y-2">
        {arr.map((item, idx) => (
          <div key={idx} className="rounded-2xl border bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-slate-500">#{idx + 1}</div>
              <button
                type="button"
                onClick={() => {
                  const next = clone(arr);
                  next.splice(idx, 1);
                  onChange(next);
                }}
                className="px-2 py-1 rounded-lg border bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs"
              >
                Smazat
              </button>
            </div>

            <JsonForm
              value={item}
              onChange={(v) => {
                const next = clone(arr);
                next[idx] = v;
                onChange(next);
              }}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          className="w-full px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
        >
          + Přidat
        </button>
      </div>
    );
  }

  // Object
  const obj = value;
  const keys = Object.keys(obj);

  return (
    <div className="space-y-3">
      {keys.map((k) => (
        <div key={k} className="rounded-2xl border bg-white p-3">
          <div className="text-xs font-semibold text-slate-700 mb-2">{k}</div>

          <JsonForm
            value={obj[k]}
            onChange={(v) => {
              const next = clone(obj);
              next[k] = v;
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function normalizeAnalysisPayload(payloadObjRaw) {
  const payloadObj = payloadObjRaw && typeof payloadObjRaw === "object" ? payloadObjRaw : {};
  const next = clone(payloadObj);

  // legend: když je string (staré), převedeme na {red:string, blue:""}
  if (typeof next.legend === "string") {
    next.legend = { red: next.legend, blue: "" };
  }
  if (next.legend == null || typeof next.legend !== "object" || Array.isArray(next.legend)) {
    next.legend = { red: "", blue: "" };
  }
  if (typeof next.legend.red !== "string") next.legend.red = next.legend.red == null ? "" : String(next.legend.red);
  if (typeof next.legend.blue !== "string") next.legend.blue = next.legend.blue == null ? "" : String(next.legend.blue);

  if (typeof next.text !== "string") next.text = next.text == null ? "" : String(next.text);

  if (!Array.isArray(next.questions)) next.questions = [];
  next.questions = next.questions.map((q) => {
    const qq = q && typeof q === "object" ? { ...q } : {};
    if (typeof qq.question !== "string") qq.question = qq.question == null ? "" : String(qq.question);
    if (typeof qq.answer !== "string") qq.answer = qq.answer == null ? "" : String(qq.answer);
    if (typeof qq.explanation !== "string") qq.explanation = qq.explanation == null ? "" : String(qq.explanation);

    // words: [{word, color}] — pro klikací segmenty po slovech
    if (!Array.isArray(qq.words)) qq.words = [];
    qq.words = qq.words
      .filter((w) => w && typeof w === "object")
      .map((w) => ({
        word: typeof w.word === "string" ? w.word : w.word == null ? "" : String(w.word),
        color: w.color === "red" || w.color === "blue" ? w.color : "blue",
      }));

    return qq;
  });

  return next;
}

function splitToWords(sentence) {
  return String(sentence || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function AnalysisBuilder({ payloadObj, setPayloadObj, payloadText, setPayloadText }) {
  const normalized = useMemo(() => normalizeAnalysisPayload(payloadObj), [payloadObj]);

  useEffect(() => {
    // Když dojde k normalizaci (např. při editaci starých payloadů), synchronizujeme stav
    if (JSON.stringify(normalized) !== JSON.stringify(payloadObj)) {
      setPayloadObj(normalized);
      setPayloadText(toJsonText(normalized));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized]);

  const setAndSync = (nextObj) => {
    setPayloadObj(nextObj);
    setPayloadText(toJsonText(nextObj));
  };

  const updateLegend = (key, val) => {
    const next = clone(normalized);
    next.legend = next.legend || { red: "", blue: "" };
    next.legend[key] = val;
    setAndSync(next);
  };

  const updateText = (val) => {
    const next = clone(normalized);
    next.text = val;
    setAndSync(next);
  };

  const addQuestion = () => {
    const next = clone(normalized);
    next.questions = Array.isArray(next.questions) ? next.questions : [];
    next.questions.push({
      question: "",
      words: [],
      answer: "",
      explanation: "",
    });
    setAndSync(next);
  };

  const deleteQuestion = (idx) => {
    const next = clone(normalized);
    next.questions.splice(idx, 1);
    setAndSync(next);
  };

  const updateQuestionField = (idx, field, val) => {
    const next = clone(normalized);
    next.questions[idx] = next.questions[idx] || { question: "", words: [], answer: "", explanation: "" };
    next.questions[idx][field] = val;
    setAndSync(next);
  };

  const generateWordsFromSentence = (idx) => {
    const next = clone(normalized);
    const q = next.questions[idx] || { question: "", words: [], answer: "", explanation: "" };
    const words = splitToWords(q.question);
    q.words = words.map((w) => ({ word: w, color: "blue" }));
    // ✅ “answer” necháme jako string (kvůli kompatibilitě), ale můžeš ho používat i jako nápovědu.
    // V Play.jsx by se mělo vyhodnocovat primárně přes q.words (to chce i ta hláška v UI).
    q.answer = q.answer || "";
    next.questions[idx] = q;
    setAndSync(next);
  };

  const updateWord = (qIdx, wIdx, patch) => {
    const next = clone(normalized);
    const q = next.questions[qIdx];
    q.words[wIdx] = { ...q.words[wIdx], ...patch };
    setAndSync(next);
  };

  const deleteWord = (qIdx, wIdx) => {
    const next = clone(normalized);
    const q = next.questions[qIdx];
    q.words.splice(wIdx, 1);
    setAndSync(next);
  };

  const addWordManual = (qIdx) => {
    const next = clone(normalized);
    const q = next.questions[qIdx];
    q.words.push({ word: "", color: "blue" });
    setAndSync(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">Payload (formulář)</label>
        <div className="text-xs text-slate-500">
          Analysis režim: legend (red/blue) + words segmenty (mezera = jedno slovo).
        </div>
      </div>

      <div className="mt-2 rounded-2xl border p-4 bg-slate-50 space-y-4">
        {/* legend: 2 okýnka */}
        <div className="rounded-2xl border bg-white p-3">
          <div className="text-xs font-semibold text-slate-700 mb-2">legend</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">red:</div>
              <input
                value={normalized.legend?.red ?? ""}
                onChange={(e) => updateLegend("red", e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Co znamená red…"
              />
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">blue:</div>
              <input
                value={normalized.legend?.blue ?? ""}
                onChange={(e) => updateLegend("blue", e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Co znamená blue…"
              />
            </div>
          </div>
        </div>

        {/* text */}
        <div className="rounded-2xl border bg-white p-3">
          <div className="text-xs font-semibold text-slate-700 mb-2">text</div>
          <input
            value={normalized.text ?? ""}
            onChange={(e) => updateText(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Text k rozboru…"
          />
        </div>

        {/* questions */}
        <div className="rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">questions</div>
            <button
              type="button"
              onClick={addQuestion}
              className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
            >
              + Přidat otázku
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {(normalized.questions || []).length === 0 ? (
              <div className="text-sm text-slate-500">Zatím žádné otázky.</div>
            ) : (
              normalized.questions.map((q, idx) => (
                <div key={idx} className="rounded-2xl border bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-500">#{idx + 1}</div>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(idx)}
                      className="px-2 py-1 rounded-lg border bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs"
                    >
                      Smazat
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">question</div>
                      <input
                        value={q.question ?? ""}
                        onChange={(e) => updateQuestionField(idx, "question", e.target.value)}
                        className="w-full rounded-xl border px-3 py-2"
                        placeholder="Sem napiš větu / slova. Mezery = segmenty."
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => generateWordsFromSentence(idx)}
                          className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                        >
                          Rozdělit na slova
                        </button>
                        <div className="text-xs text-slate-500">
                          Udělá words[] z question (segment = slovo).
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-700">words (klikací segmenty)</div>
                        <button
                          type="button"
                          onClick={() => addWordManual(idx)}
                          className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                        >
                          + Přidat segment
                        </button>
                      </div>

                      <div className="mt-2 space-y-2">
                        {(q.words || []).length === 0 ? (
                          <div className="text-sm text-slate-500">
                            Zatím nejsou segmenty. Klikni „Rozdělit na slova“ nebo přidej ručně.
                          </div>
                        ) : (
                          (q.words || []).map((w, wIdx) => (
                            <div key={wIdx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                              <div className="md:col-span-7">
                                <input
                                  value={w.word ?? ""}
                                  onChange={(e) => updateWord(idx, wIdx, { word: e.target.value })}
                                  className="w-full rounded-xl border px-3 py-2"
                                  placeholder="slovo"
                                />
                              </div>
                              <div className="md:col-span-3">
                                <select
                                  value={w.color === "red" ? "red" : "blue"}
                                  onChange={(e) => updateWord(idx, wIdx, { color: e.target.value })}
                                  className="w-full rounded-xl border px-3 py-2"
                                >
                                  <option value="blue">blue</option>
                                  <option value="red">red</option>
                                </select>
                              </div>
                              <div className="md:col-span-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteWord(idx, wIdx)}
                                  className="px-2 py-2 rounded-xl border bg-white hover:bg-rose-50 text-rose-700 font-semibold text-sm w-full"
                                >
                                  Smazat
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        Play.jsx (podle hlášky v UI) očekává u otázky `words: [{`{"word":"A","color":"red"}`}...]`.
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">answer</div>
                      <input
                        value={q.answer ?? ""}
                        onChange={(e) => updateQuestionField(idx, "answer", e.target.value)}
                        className="w-full rounded-xl border px-3 py-2"
                        placeholder="Volitelné (pokud Play používá words, answer nemusí být potřeba)"
                      />
                      <div className="mt-2 text-xs text-slate-500">
                        Pokud chceš mít i “readable” answer, můžeš sem psát např. „pes:red, je:blue, bílej:blue“.
                        Vyhodnocení se ale má opírat o words[].
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700 mb-2">explanation</div>
                      <input
                        value={q.explanation ?? ""}
                        onChange={(e) => updateQuestionField(idx, "explanation", e.target.value)}
                        className="w-full rounded-xl border px-3 py-2"
                        placeholder="Vysvětlení (volitelné)…"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <textarea
          value={payloadText}
          onChange={(e) => {
            const nextText = e.target.value;
            setPayloadText(nextText);
            try {
              const parsed = JSON.parse(nextText);
              setPayloadObj(parsed);
            } catch {
              // ignorujeme invalid JSON (uživatel může dopsat)
            }
          }}
          className="mt-1 w-full rounded-2xl border px-3 py-2 font-mono text-sm min-h-[240px]"
        />
        <p className="text-xs text-slate-500 mt-2">
          Pokročilé: JSON je stále “zdroj pravdy”. Jakmile je validní, formulář se synchronizuje.
        </p>
      </div>
    </div>
  );
}

function PayloadBuilder({ type, payloadObj, setPayloadObj, payloadText, setPayloadText }) {
  const [showJson, setShowJson] = useState(false);

  // ✅ Special UI pro analysis
  if (type === "analysis") {
    return (
      <div>
        <AnalysisBuilder
          payloadObj={payloadObj}
          setPayloadObj={setPayloadObj}
          payloadText={payloadText}
          setPayloadText={setPayloadText}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">Payload (formulář)</label>
        <button
          type="button"
          onClick={() => setShowJson((s) => !s)}
          className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
        >
          {showJson ? "Skrýt JSON" : "Pokročilé: JSON"}
        </button>
      </div>

      <div className="mt-2 rounded-2xl border p-3 bg-slate-50">
        <JsonForm
          value={payloadObj || {}}
          onChange={(nextObj) => {
            setPayloadObj(nextObj);
            setPayloadText(toJsonText(nextObj));
          }}
        />
      </div>

      {showJson && (
        <div className="mt-3">
          <textarea
            value={payloadText}
            onChange={(e) => {
              const nextText = e.target.value;
              setPayloadText(nextText);
              try {
                const parsed = JSON.parse(nextText);
                setPayloadObj(parsed);
              } catch {
                // ignorujeme invalid JSON (uživatel může dopsat)
              }
            }}
            className="mt-1 w-full rounded-2xl border px-3 py-2 font-mono text-sm min-h-[260px]"
          />
          <p className="text-xs text-slate-500 mt-2">
            Pokročilé: můžeš upravit JSON ručně. Formulář se synchronizuje, jakmile je JSON validní.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-2">
        Tip: Pole (questions/pairs/cards/items/options/categories) mají tlačítko “+ Přidat” a každý řádek jde smazat.
      </p>

      <div className="mt-3 text-xs text-slate-500">
        Aktivní typ: <span className="font-semibold text-slate-700">{type}</span>
      </div>
    </div>
  );
}

export default function Admin() {
  // ✅ auth/admin gate
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null); // null = loading, true/false = hotovo
  const [gateError, setGateError] = useState(null);

  // ✅ list existujících úloh
  const [items, setItems] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // ✅ edit/create stav
  const [editingId, setEditingId] = useState(null); // pokud je id -> update, jinak insert
  const [type, setType] = useState("decision");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");

  // metadata pro filtrování ve tvém appu (topic/category/difficulty/test)
  const [topicId, setTopicId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [isTest, setIsTest] = useState(false);

  const [payloadText, setPayloadText] = useState(toJsonText(templateFor("decision")));
  const [payloadObj, setPayloadObj] = useState(templateFor("decision"));

  const topicOptions = useMemo(() => {
    const arr = Array.isArray(topicsData) ? topicsData : [];
    const cleaned = arr
      .filter((t) => t && t.id)
      .map((t) => ({
        id: String(t.id),
        subject: String(t.subject || ""),
        grade: Number(t.grade || 0) || 0,
        name: String(t.name || ""),
        order: Number(t.order || 0) || 0,
      }));

    cleaned.sort((a, b) => {
      const s = a.subject.localeCompare(b.subject, "cs");
      if (s !== 0) return s;
      const g = a.grade - b.grade;
      if (g !== 0) return g;
      const o = a.order - b.order;
      if (o !== 0) return o;
      return a.name.localeCompare(b.name, "cs");
    });

    return cleaned;
  }, []);

  const categoryOptions = useMemo(() => {
    const arr = Array.isArray(categoriesData) ? categoriesData : [];
    const cleaned = arr
      .filter((c) => c && c.id && String(c.topic_id || "") === String(topicId || ""))
      .map((c) => ({
        id: String(c.id),
        topic_id: String(c.topic_id || ""),
        name: String(c.name || ""),
        description: String(c.description || ""),
        order: Number(c.order || 0) || 0,
      }));

    cleaned.sort((a, b) => {
      const o = a.order - b.order;
      if (o !== 0) return o;
      return a.name.localeCompare(b.name, "cs");
    });

    return cleaned;
  }, [topicId]);

  const selectedTopicLabel = useMemo(() => {
    const hit = topicOptions.find((t) => t.id === String(topicId || ""));
    if (!hit) return "";
    return `${hit.subject} • ${hit.grade}. třída • ${hit.name}`;
  }, [topicId, topicOptions]);

  const selectedCategoryLabel = useMemo(() => {
    const hit = categoryOptions.find((c) => c.id === String(categoryId || ""));
    if (!hit) return "";
    return hit.description || hit.name || "";
  }, [categoryId, categoryOptions]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // ✅ načti user
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setUser(null);
        return;
      }
      setUser(data?.user || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ✅ ověř admin přes rpc is_admin(uid uuid)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setGateError(null);
      setIsAdmin(null);

      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase.rpc("is_admin", { uid: user.id });
      if (!alive) return;

      if (error) {
        setGateError(error.message);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(!!data);
    };

    run();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const canSeeAdmin = isAdmin === true;

  // ✅ když se změní typ, nabídni šablonu (ať nelepíš JSON ručně)
  const onChangeType = (nextType) => {
    setType(nextType);

    // Pokud už někdo něco napsal, nechceme mu to vždy přepsat.
    // Ale pokud je payload stále "prázdný" nebo jsme právě založili novou úlohu, šablonu použij.
    noteMessage(`ℹ️ Přepnuto na typ: ${nextType}. Můžeš použít šablonu níže.`);
  };

  const applyTemplate = () => {
    const t = templateFor(type);
    setPayloadObj(t);
    setPayloadText(toJsonText(t));
    setMessage("✅ Šablona byla vložena do payloadu.");
  };

  const noteMessage = (txt) => setMessage(txt);

  // ✅ načti list úloh
  const loadList = async () => {
    setLoadingList(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("exercises")
      .select("id, created_at, type, title, topic_id, category_id, instructions, payload")
      .order("created_at", { ascending: false })
      .limit(200);

    setLoadingList(false);

    if (error) {
      setMessage("❌ Chyba načítání seznamu: " + error.message);
      return;
    }
    setItems(data || []);
  };

  useEffect(() => {
    if (canSeeAdmin) loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeAdmin]);

  // ✅ načíst položku do editace
  const editItem = (row) => {
    setEditingId(row.id);
    setType(row.type || "decision");
    setTitle(row.title || "");
    setInstructions(row.instructions || "");
    setTopicId(row.topic_id || "");
    setCategoryId(row.category_id || "");

    let obj = row.payload || {};

    // ✅ pokud editujeme analysis, normalizuj legend + words strukturu
    if ((row.type || "") === "analysis") {
      obj = normalizeAnalysisPayload(obj);
    }

    setPayloadObj(obj);
    setPayloadText(toJsonText(obj));

    // is_test + difficulty – pokud je ukládáš jinde, bude to zatím false/1
    // (když chceš, dáme do DB sloupce, nebo to uložíme do payloadu)
    setIsTest(row.type === "test");
    setDifficulty(1);

    setMessage("✏️ Načteno do editace. Ulož = UPDATE.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setType("decision");
    setTitle("");
    setInstructions("");
    setTopicId("");
    setCategoryId("");
    setDifficulty(1);
    setIsTest(false);

    const t = templateFor("decision");
    setPayloadObj(t);
    setPayloadText(toJsonText(t));

    setMessage("🧹 Nová úloha (INSERT).");
  };

  // ✅ insert / update
  const saveExercise = async () => {
    setMessage(null);

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setMessage("❌ Payload není platný JSON");
      return;
    }

    if (!title.trim()) {
      setMessage("❌ Název úlohy je povinný");
      return;
    }

    // ✅ ukládáme topic/category do sloupců (jak máš tabulku)
    // difficulty + is_test můžeš řešit:
    // - buď přidat sloupce do tabulky
    // - nebo to uložit do payloadu (zatím zvolíme payload)
    const finalType = isTest ? "test" : type;

    // ✅ pro analysis ještě jednou “pojistka” normalizace (aby se neuložil starý legend string)
    let normalizedPayload = payload;
    if (finalType === "analysis") {
      normalizedPayload = normalizeAnalysisPayload(payload);
    }

    const finalPayload = {
      ...normalizedPayload,
      // metadata do payloadu (dokud nejsou sloupce)
      difficulty: Number(difficulty) || 1,
      is_test: !!isTest,
    };

    setSaving(true);

    let res;
    if (editingId) {
      res = await supabase
        .from("exercises")
        .update({
          type: finalType,
          title: title.trim(),
          instructions: instructions || null,
          topic_id: topicId || null,
          category_id: categoryId || null,
          payload: finalPayload,
        })
        .eq("id", editingId);
    } else {
      res = await supabase.from("exercises").insert({
        type: finalType,
        title: title.trim(),
        instructions: instructions || null,
        topic_id: topicId || null,
        category_id: categoryId || null,
        payload: finalPayload,
      });
    }

    setSaving(false);

    if (res?.error) {
      setMessage("❌ Chyba: " + res.error.message);
      return;
    }

    setMessage(editingId ? "✅ Úloha upravena (update)" : "✅ Úloha byla uložena (insert)");
    await loadList();

    if (!editingId) {
      setTitle("");
      setInstructions("");
      // payload necháme (ať admin může tvořit více podobných)
    }
  };

  const deleteExercise = async (id) => {
    if (!window.confirm("Opravdu smazat tuto úlohu?")) return;

    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) {
      setMessage("❌ Smazání selhalo: " + error.message);
      return;
    }
    setMessage("🗑️ Smazáno.");
    if (editingId === id) resetForm();
    await loadList();
  };

  // ====== UI ======
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Ověřuji práva…</div>
      </div>
    );
  }

  if (!canSeeAdmin) {
    // ✅ skryj admin úplně – žádné UI pro ne-adminy
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl border p-6 text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h1 className="text-xl font-bold text-slate-800">Nemáš přístup do adminu</h1>
          <p className="text-slate-600 mt-2">Tento účet není admin. Přihlas se admin účtem.</p>
          {gateError && <p className="text-xs text-rose-600 mt-3">Chyba: {gateError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl border p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">Admin – správa úloh</h1>
              <p className="text-slate-500 mt-1">
                Vytvářej / upravuj úlohy. JSON je zatím “zdroj pravdy”, ale máš šablony pro každý typ.
              </p>
            </div>

            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 font-semibold"
              type="button"
            >
              + Nová úloha
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border bg-slate-50 p-3 text-sm text-slate-700">{message}</div>
          )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* левý sloupec */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Typ úlohy</label>
                <select value={type} onChange={(e) => onChangeType(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
                  {EXERCISE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={applyTemplate}
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                  >
                    Vložit šablonu pro typ
                  </button>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
                    Finální test (vynutí type=test)
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Název</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  placeholder="Např. Vyjmenovaná slova po B"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Instrukce</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 min-h-[90px]"
                  placeholder="Krátký popis pro uživatele…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">topic_id</label>
                  <select
                    value={topicId}
                    onChange={(e) => {
                      setTopicId(e.target.value);
                      setCategoryId("");
                    }}
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                  >
                    <option value="">Vyber téma…</option>
                    {topicOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.subject} • {t.grade}. třída • {t.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {topicId ? `Vybráno: ${selectedTopicLabel} (ID: ${topicId})` : "Vyber subject / grade / name → uloží se topic_id."}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">category_id</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    disabled={!topicId}
                  >
                    <option value="">{topicId ? "Vyber kategorii…" : "Nejdřív vyber téma…"}</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.description || c.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {categoryId ? `Vybráno: ${selectedCategoryLabel} (ID: ${categoryId})` : "Vybereš popis → uloží se category_id."}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Obtížnost (1–3)</label>
                <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value={1}>1 – lehké</option>
                  <option value={2}>2 – střední</option>
                  <option value={3}>3 – těžké</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Zatím se ukládá do payloadu (difficulty, is_test). Pokud chceš, přidáme sloupce do DB.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={saveExercise}
                  disabled={saving}
                  className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 disabled:opacity-60"
                  type="button"
                >
                  {saving ? "Ukládám…" : editingId ? "Uložit změny" : "Vytvořit úlohu"}
                </button>

                {editingId && (
                  <button
                    onClick={() => deleteExercise(editingId)}
                    className="px-4 py-3 rounded-2xl border bg-white hover:bg-rose-50 text-rose-700 font-bold"
                    type="button"
                  >
                    Smazat
                  </button>
                )}
              </div>
            </div>

            {/* pravý sloupec */}
            <div className="space-y-4">
              <div>
                <PayloadBuilder
                  type={type}
                  payloadObj={payloadObj}
                  setPayloadObj={setPayloadObj}
                  payloadText={payloadText}
                  setPayloadText={setPayloadText}
                />
                <p className="text-xs text-slate-500 mt-2">Teď je to “jádro” úlohy. Formulář je klikací builder (přidat otázku/řádek tlačítkem).</p>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-slate-800">Existující úlohy</div>
                  <button
                    type="button"
                    onClick={loadList}
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                  >
                    {loadingList ? "Načítám…" : "Obnovit"}
                  </button>
                </div>

                <div className="mt-3 max-h-[260px] overflow-auto border rounded-xl">
                  {(items || []).length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">Zatím žádné úlohy.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left p-2">Typ</th>
                          <th className="text-left p-2">Název</th>
                          <th className="text-right p-2">Akce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="p-2 text-slate-700">{row.type}</td>
                            <td className="p-2 text-slate-800 font-semibold">{row.title}</td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => editItem(row)}
                                className="px-2 py-1 rounded-lg border bg-white hover:bg-slate-50 text-slate-700 font-semibold mr-2"
                              >
                                Upravit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteExercise(row.id)}
                                className="px-2 py-1 rounded-lg border bg-white hover:bg-rose-50 text-rose-700 font-semibold"
                              >
                                Smazat
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-2">Tip: Klikni “Upravit”, uprav payload a dej “Uložit změny”.</p>
              </div>
            </div>
          </div>
        </div>

        {/* poznámka dole */}
        <div className="mt-4 text-xs text-slate-500">
          ✅ Admin přístup je chráněný přes RLS + `is_admin()`. I kdyby někdo otevřel /admin, bez role admin nic neuloží.
        </div>
      </div>
    </div>
  );
}
