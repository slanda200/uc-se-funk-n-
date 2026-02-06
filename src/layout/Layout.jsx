import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, User, LogOut, Trophy } from 'lucide-react'; // ✅ Trophy přidáno
import { Button } from '@/components/ui/button';
import SearchBar from '@/components/layout/SearchBar';
import BrainLogo from '@/components/layout/BrainLogo';
import LoginModal from '@/components/LoginModal';
import { supabase } from '@/lib/supabaseClient';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // ✅ username z profiles
  const [username, setUsername] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Načtení session + poslouchání změn (login/logout)
  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data?.user ?? null);
      setLoadingUser(false);
    };

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ✅ Načti username z profiles pokaždé když se změní user
  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      if (!user?.id) {
        setUsername('');
        return;
      }

      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          setUsername('');
          return;
        }

        setUsername((data?.username || '').trim());
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ✅ Zobrazování jména/initialu (preferuj username)
  const displayName =
    username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'Uživatel';

  const initial = (displayName?.[0] || 'U').toUpperCase();

  // ✅ NOVÉ: Flowise chat (nahrazuje starý ChatWidget)
  useEffect(() => {
    // ====== Limity pro chat (frontend-only) ======
    // Flowise embed nemá nativně "max words" ani denní limit uploadů.
    // Proto to hlídáme přes DOM hooky (odeslání + file input + drag&drop) a ukládáme do localStorage.
    const MAX_WORDS_PER_MESSAGE = 120;
    const MAX_IMAGES_PER_DAY = 5;
    const STORAGE_KEY = 'ucse_chat_image_uploads_v1';

    const todayKey = () => {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const readUploadState = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (_) {}
      return {};
    };

    const writeUploadState = (state) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (_) {}
    };

    const getTodayUploads = () => {
      const state = readUploadState();
      return Number(state[todayKey()] || 0);
    };

    const addTodayUploads = (n) => {
      const state = readUploadState();
      const key = todayKey();
      const current = Number(state[key] || 0);
      state[key] = current + n;
      writeUploadState(state);
      return state[key];
    };

    const countWords = (text) => {
      return (text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
    };

    // Hluboké procházení i Shadow DOM (Flowise často používá shadowRoot)
    const deepQueryAll = (selector, root = document) => {
      const out = [];
      const visit = (node) => {
        if (!node) return;
        try {
          if (node.querySelectorAll) out.push(...node.querySelectorAll(selector));
        } catch (_) {}
        const kids = node.children ? Array.from(node.children) : [];
        for (const k of kids) visit(k);
        if (node.shadowRoot) visit(node.shadowRoot);
      };
      visit(root);
      // oddup
      return Array.from(new Set(out));
    };

    const showWarning = (msg) => {
      // jednoduché UX: alert; můžeš později nahradit vlastním toastem
      try {
        window.alert(msg);
      } catch (_) {}
    };

    // jen pro prihlasene
    if (loadingUser || !user) {
      // pokus o uklid flowise widgetu pri odhlaseni (kdyby zustal v DOM)
      try {
        document.getElementById('flowise-chatbot')?.remove();
        document.getElementById('flowise-chatbot-container')?.remove();
        document.getElementById('flowise-chatbot-button')?.remove();
      } catch (_) {}
      // povol znovu init pri dalsim login
      window.__FLOWISE_CHAT_INIT__ = false;
      return;
    }

    // zamez dvojite inicializaci
    if (window.__FLOWISE_CHAT_INIT__) return;
    window.__FLOWISE_CHAT_INIT__ = true;

    const userAvatar =
      user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture ||
      user?.user_metadata?.photoURL ||
      null;

    const script = document.createElement('script');
    script.type = 'module';
    script.dataset.flowise = 'true';

    // Pozn.: favicon v public -> dostupne jako /favicon.png
    script.textContent = `
      import Chatbot from "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js";

      Chatbot.init({
        chatflowid: "7ff44996-b789-4c17-80dd-1566bce8b3c7",
        apiHost: "https://cloud.flowiseai.com",
        theme: {
          button: {
            backgroundColor: "#7C3AED",
            right: 20,
            bottom: 20,
            size: 56,
            dragAndDrop: true,
            iconColor: "white",
            customIconSrc: "/favicon.png",
            autoWindowOpen: {
              autoOpen: false,
              openDelay: 0,
              autoOpenOnMobile: false
            }
          },
          tooltip: {
            showTooltip: true,
            tooltipMessage: "Ahoj 👋",
            tooltipBackgroundColor: "#111827",
            tooltipTextColor: "white",
            tooltipFontSize: 14
          },
          chatWindow: {
            showTitle: true,
            showAgentMessages: true,
            title: "Učící chat",
            titleAvatarSrc: "/favicon.png",
            welcomeMessage: "Ahoj! Jsem učící pomocník. Zeptej se na cokoli ze školy (čeština, matika, aj.). 🙂",
            errorMessage: "Chyba při volání AI. Zkus to prosím znovu.",
            backgroundColor: "#ffffff",
            height: 680,
            width: 400,
            fontSize: 15,
            clearChatOnReload: false,
            renderHTML: true,
            botMessage: {
              backgroundColor: "#F3F4F6",
              textColor: "#111827",
              showAvatar: true,
              avatarSrc: "/favicon.png"
            },
            userMessage: {
              backgroundColor: "#7C3AED",
              textColor: "#ffffff",
              showAvatar: true,
              avatarSrc: ${userAvatar ? JSON.stringify(userAvatar) : 'undefined'}
            },
            textInput: {
              placeholder: "Napiš dotaz…",
              backgroundColor: "#ffffff",
              textColor: "#111827",
              sendButtonColor: "#7C3AED",
              maxChars: 600,
              maxCharsWarningMessage: "Zkrať prosím zprávu (max 600 znaků).",
              autoFocus: false,
              sendMessageSound: false,
              receiveMessageSound: false
            },
            feedback: { color: "#111827" },
            dateTimeToggle: { date: false, time: false },
            footer: {
              textColor: "#6B7280",
              text: "",
              company: "",
              companyLink: ""
            }
          }
        }
      });
    `;

    document.body.appendChild(script);

    // Po inicializaci widgetu přidáme hooky na omezení (polling, protože Flowise DOM se renderuje async)
    let cleanupFns = [];
    const seen = new WeakSet();

    const attachGuards = () => {
      // 1) Max words (Enter / Send button)
      const textareas = deepQueryAll('textarea');
      for (const ta of textareas) {
        if (!ta || seen.has(ta)) continue;
        seen.add(ta);

        const onKeyDown = (e) => {
          // Flowise většinou odesílá na Enter (bez Shift)
          if (e.key === 'Enter' && !e.shiftKey) {
            const words = countWords(ta.value);
            if (words > MAX_WORDS_PER_MESSAGE) {
              e.preventDefault();
              e.stopPropagation();
              showWarning(`Zkrať prosím zprávu (max ${MAX_WORDS_PER_MESSAGE} slov).`);
            }
          }
        };
        ta.addEventListener('keydown', onKeyDown, true);
        cleanupFns.push(() => ta.removeEventListener('keydown', onKeyDown, true));
      }

      // Některé verze Flowise mají "send" tlačítko jako button[type=submit] nebo jen button s ikonou
      const buttons = deepQueryAll('button');
      for (const btn of buttons) {
        if (!btn || seen.has(btn)) continue;
        // heuristika: tlačítka ve flowise chat okně mají často aria-label "Send" nebo title "Send"
        const label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
        const maybeSend = label.includes('send') || label.includes('odeslat') || label.includes('poslat');
        if (!maybeSend) continue;
        seen.add(btn);

        const onClickCapture = (e) => {
          const ta = deepQueryAll('textarea')[0];
          if (!ta) return;
          const words = countWords(ta.value);
          if (words > MAX_WORDS_PER_MESSAGE) {
            e.preventDefault();
            e.stopPropagation();
            showWarning(`Zkrať prosím zprávu (max ${MAX_WORDS_PER_MESSAGE} slov).`);
          }
        };
        btn.addEventListener('click', onClickCapture, true);
        cleanupFns.push(() => btn.removeEventListener('click', onClickCapture, true));
      }

      // 2) Denní limit obrázků (file input + drag&drop)
      const fileInputs = deepQueryAll('input[type="file"]');
      for (const input of fileInputs) {
        if (!input || seen.has(input)) continue;
        seen.add(input);

        const onChange = (e) => {
          const files = input.files ? Array.from(input.files) : [];
          if (!files.length) return;

          // počítáme jen obrázky
          const imageFiles = files.filter((f) => (f?.type || '').startsWith('image/'));
          if (!imageFiles.length) return;

          const used = getTodayUploads();
          if (used >= MAX_IMAGES_PER_DAY) {
            // zablokuj upload
            input.value = '';
            e.preventDefault?.();
            e.stopPropagation?.();
            showWarning(`Dnes už jsi poslal(a) maximum obrázků (${MAX_IMAGES_PER_DAY}/den).`);
            return;
          }

          const remaining = MAX_IMAGES_PER_DAY - used;
          if (imageFiles.length > remaining) {
            input.value = '';
            e.preventDefault?.();
            e.stopPropagation?.();
            showWarning(`Můžeš dnes poslat už jen ${remaining} obrázek/obrázky (limit ${MAX_IMAGES_PER_DAY}/den).`);
            return;
          }

          addTodayUploads(imageFiles.length);
        };

        input.addEventListener('change', onChange, true);
        cleanupFns.push(() => input.removeEventListener('change', onChange, true));
      }

      // Drag&drop obrázků do chatu (globální zachyt – Flowise to chytá uvnitř)
      const onDropCapture = (e) => {
        const dt = e.dataTransfer;
        if (!dt?.files?.length) return;
        const files = Array.from(dt.files);
        const imageFiles = files.filter((f) => (f?.type || '').startsWith('image/'));
        if (!imageFiles.length) return;

        const used = getTodayUploads();
        const remaining = MAX_IMAGES_PER_DAY - used;
        if (remaining <= 0) {
          e.preventDefault();
          e.stopPropagation();
          showWarning(`Dnes už jsi poslal(a) maximum obrázků (${MAX_IMAGES_PER_DAY}/den).`);
          return;
        }
        if (imageFiles.length > remaining) {
          e.preventDefault();
          e.stopPropagation();
          showWarning(`Můžeš dnes poslat už jen ${remaining} obrázek/obrázky (limit ${MAX_IMAGES_PER_DAY}/den).`);
          return;
        }

        addTodayUploads(imageFiles.length);
      };

      document.addEventListener('drop', onDropCapture, true);
      cleanupFns.push(() => document.removeEventListener('drop', onDropCapture, true));
    };

    // polling, dokud se chat nevyrenderuje; pak už attach jen přidává nové elementy pokud přibydou
    const interval = setInterval(attachGuards, 500);
    cleanupFns.push(() => clearInterval(interval));

    return () => {
      try {
        script.remove();
      } catch (_) {}

      try {
        cleanupFns.forEach((fn) => {
          try { fn(); } catch (_) {}
        });
      } catch (_) {}
    };
  }, [loadingUser, user]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white/95 border-b border-slate-100 sticky top-0 z-50 overflow-visible">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 overflow-visible">
            {/* Logo */}
            <Link to={createPageUrl('Home')} className="flex items-center gap-2">
              <BrainLogo size={40} />
              <span className="text-xl font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent hidden sm:block">
                Uč se snadně
              </span>
            </Link>

            {/* Search (✅ wrapper kvůli popover pozici) */}
            <div className="flex-1 max-w-2xl mx-4 relative z-[70] overflow-visible">
              <SearchBar />
            </div>

            {/* User menu */}
            {!loadingUser && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 rounded-xl">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {initial}
                      </span>
                    </div>

                    <span className="hidden sm:block text-slate-700 font-medium">
                      {loadingProfile ? '...' : displayName}
                    </span>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl">
                  <DropdownMenuItem asChild className="p-0">
                    <Link
                      to={createPageUrl('Home')}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 transition w-full"
                    >
                      <Home className="w-4 h-4" />
                      Domů
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className="p-0">
                    <Link
                      to={createPageUrl('Profile')}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 transition w-full"
                    >
                      <User className="w-4 h-4" />
                      Můj profil
                    </Link>
                  </DropdownMenuItem>

                  {/* ✅ NOVÉ: Leaderboard */}
                  <DropdownMenuItem asChild className="p-0">
                    <Link
                      to={createPageUrl('Leaderboard')}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 transition w-full"
                    >
                      <Trophy className="w-4 h-4" />
                      Leaderboard
                    </Link>
                  </DropdownMenuItem>

                  <div className="my-2">
                    <DropdownMenuSeparator />
                  </div>

                  <DropdownMenuItem onClick={handleLogout} className="p-0">
                    <button
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition w-full text-red-600"
                      type="button"
                    >
                      <LogOut className="w-4 h-4" />
                      Odhlásit se
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => setLoginOpen(true)}
                className="
                  h-11 px-6 text-base font-semibold rounded-xl
                  bg-gradient-to-r from-amber-500 to-orange-500
                  hover:opacity-95
                  "
              >
                Přihlásit se
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Login modal */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      {/* Main content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-sm">
          <div className="inline-flex items-center justify-center gap-3">
            <p>© 2026 Uč se snadně - Učení hrou pro děti</p>
            <Link to="/admin" title="Admin">
              <Button variant="outline" className="h-7 w-7 p-0 rounded-full text-xs font-bold leading-none">
                A
              </Button>
            </Link>
          </div>
        </div>
      </footer>

      {/* ❌ Starý ChatWidget pryč – Flowise běží přes init výše */}
    </div>
  );
}
