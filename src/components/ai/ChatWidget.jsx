import React from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Trash2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "eduup_ai_chat_v1";

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

export default function ChatWidget() {
  const navigate = useNavigate();

  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");

  const [messages, setMessages] = React.useState(() => {
    const loaded = loadMessages();
    return (
      loaded ?? [
        {
          id: crypto?.randomUUID?.() ?? String(Date.now()),
          role: "assistant",
          content:
            "Ahoj! Jsem učící pomocník. Zeptej se na cokoli ke škole (čeština, matika, aj.). 🙂",
          ts: Date.now(),
        },
      ]
    );
  });

  const [isTyping, setIsTyping] = React.useState(false);
  const [session, setSession] = React.useState(null);
  const [sessionLoading, setSessionLoading] = React.useState(true);

  const isAuthed = !!session;

  const listRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => saveMessages(messages), [messages]);

  // session + listener
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        setSession(data?.session ?? null);
      } finally {
        if (alive) setSessionLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      setSessionLoading(false);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, isTyping]);

  function addMessage(role, content) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`,
        role,
        content,
        ts: Date.now(),
      },
    ]);
  }

  async function send() {
    const text = input.trim();
    if (!text || isTyping) return;

    if (!isAuthed) {
      addMessage("assistant", "Pro psaní s učitelem se musíš přihlásit 🙂");
      return;
    }

    setInput("");
    // user message
    const userMsg = {
      id: crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`,
      role: "user",
      content: text,
      ts: Date.now(),
    };

    // lokálně hned přidáme user zprávu
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const { data: sessData } = await supabase.auth.getSession();
      const accessToken = sessData?.session?.access_token;
      if (!accessToken) {
        throw new Error("NO_AUTH");
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // vezmeme posledních N zpráv + tu novou (bez id/ts)
      const historyForApi = [...messages, { role: "user", content: text }]
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      // ✅ DŮLEŽITÉ:
      // 1) nepoužívat fetch na /functions/v1 ručně
      // 2) nepřidávat vlastní Authorization header
      // supabase-js sám přidá apikey i Authorization (pokud je session)
            const payload = {
        message: text,
        history: messages.slice(-30).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content ?? ""),
        })),
      };

      const r = await fetch(`${supabaseUrl}/functions/v1/gemini-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const status = r.status;
        const msg = data?.error || data?.detail || data?.message || "Neznámá chyba";
        throw new Error(`HTTP_${status}:${msg}`);
      }
if (error) {
        const status = error?.context?.status ?? "?";
        const body =
          typeof error?.context?.body === "string"
            ? error.context.body
            : JSON.stringify(error?.context?.body ?? {});
        addMessage(
          "assistant",
          `Chyba při volání AI: ${error.message}\nStatus: ${status}\nBody: ${body}`
        );
        return;
      }

            const replyText = String(data?.reply ?? data?.message?.content ?? "");

      addMessage("assistant", replyText);
    } catch (e) {
      addMessage("assistant", `Teď se mi nepodařilo odpovědět. (${String(e)})`);
    } finally {
      setIsTyping(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: crypto?.randomUUID?.() ?? String(Date.now()),
        role: "assistant",
        content: "Chat jsem vyčistil. Zeptej se na nové učivo 🙂",
        ts: Date.now(),
      },
    ]);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      {open && (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
            <div className="flex flex-col">
              <div className="font-semibold text-slate-900 leading-tight">
                Učící chat
              </div>
              <div className="text-xs text-slate-500">
                {sessionLoading
                  ? "Ověřuji přihlášení…"
                  : isAuthed
                  ? "Přihlášen • můžeš psát"
                  : "Nepřihlášen • chat je zamčený"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                title="Vymazat chat"
                className="rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                title="Zavřít"
                className="rounded-xl"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50"
          >
            {!isAuthed && !sessionLoading && (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 flex gap-2 items-start">
                <Lock className="w-4 h-4 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    Chat je jen pro přihlášené
                  </div>
                  <div className="text-slate-600">
                    Pro psaní s učitelem se musíš přihlásit.
                  </div>
                  <div className="mt-2">
                    <Button
                      className="rounded-xl"
                      onClick={() => navigate("/login")}
                    >
                      Přihlásit se
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                      m.role === "user"
                        ? "bg-slate-900 text-white rounded-br-md"
                        : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-white text-slate-700 border border-slate-200 rounded-bl-md">
                    Píšu…
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-white p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder={
                  isAuthed ? "Napiš dotaz…" : "Přihlas se, abys mohl psát…"
                }
                disabled={!isAuthed || sessionLoading}
                className="flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
              />

              <Button
                onClick={send}
                disabled={!isAuthed || sessionLoading || !input.trim() || isTyping}
                className="rounded-2xl h-10 px-3"
                title="Odeslat"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
              Tip: napiš ročník (např. 7. třída) + vlož zadání.
            </div>
          </div>
        </div>
      )}

      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="rounded-full shadow-lg h-12 w-12 p-0"
          title="Otevřít chat"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}
