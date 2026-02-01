import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search } from "lucide-react";

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const wrapperRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // ✅ Načti topics + categories (kvůli rozhodnutí, kam navigovat)
  const { data: topics = [] } = useQuery({
    queryKey: ["allTopics"],
    queryFn: () => base44.entities.Topic.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["allCategories"],
    queryFn: () => base44.entities.Category.list("order"),
  });

  const q = query.trim().toLowerCase();

  const topicHasCategories = React.useCallback(
    (topicId) => (categories || []).some((c) => String(c.topic_id) === String(topicId)),
    [categories]
  );

  const getTopicLink = React.useCallback(
    (topicId) => {
      if (topicHasCategories(topicId)) return createPageUrl(`Categories?topic=${topicId}`);
      return createPageUrl(`Exercises?topic=${topicId}`);
    },
    [topicHasCategories]
  );

  const results = React.useMemo(() => {
    if (!q) return [];
    return (topics || [])
      .filter((t) => {
        const name = (t.name || "").toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const subj = (t.subject || "").toLowerCase();
        return name.includes(q) || desc.includes(q) || subj.includes(q);
      })
      .slice(0, 10);
  }, [topics, q]);

  const selectTopic = (topic) => {
    const to = getTopicLink(topic.id);
    setOpen(false);
    setQuery("");
    // ✅ funguje odkudkoliv – naviguje na správnou stránku
    navigate(to);
    // volitelně: odfokus
    inputRef.current?.blur?.();
  };

  // zavírání při kliknutí mimo
  React.useEffect(() => {
    const onDown = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ESC zavře dropdown
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Enter = otevři 1. výsledek
  const onKeyDown = (e) => {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      selectTopic(results[0]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* ✅ Chrome password autofill hack (zabrání nabízení přihlašovacích údajů v search inputu) */}
      <input
        type="text"
        name="fakeusernameremembered"
        autoComplete="username"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="password"
        name="fakepasswordremembered"
        autoComplete="current-password"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Input */}
      <div className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600">
        <Search className="w-5 h-5" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(!!v.trim());
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Hledat témata..."
          type="search"
          name="q"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="search"
          className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="
            absolute left-0 right-0 mt-2
            bg-white rounded-2xl shadow-xl border border-slate-200
            overflow-hidden z-[200]
          "
        >
          <div className="max-h-[420px] overflow-auto">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                Žádná témata nenalezena.
              </div>
            ) : (
              <div className="py-1">
                <div className="px-4 pt-3 pb-2 text-xs uppercase tracking-wide text-slate-400">
                  Témata
                </div>

                {results.map((topic) => {
                  const hasCats = topicHasCategories(topic.id);

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => selectTopic(topic)}
                      className="
                        w-full text-left px-4 py-3
                        hover:bg-slate-50 active:bg-slate-100
                        transition
                      "
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-slate-800">{topic.name}</div>
                        {hasCats && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            kategorie
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {topic.subject} • {topic.grade}. třída
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
