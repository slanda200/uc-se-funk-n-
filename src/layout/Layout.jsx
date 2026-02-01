import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, User, LogOut, Trophy } from 'lucide-react'; // ✅ Trophy přidáno
import { Button } from '@/components/ui/button';
import SearchBar from '@/components/layout/SearchBar';
import BrainLogo from '@/components/layout/BrainLogo';
import LoginModal from '@/components/LoginModal';
import { supabase } from '@/lib/supabaseClient';
import ChatWidget from "@/components/ai/ChatWidget";


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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white/95 border-b border-slate-100 sticky top-0 z-50 overflow-visible">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 overflow-visible">
            {/* Logo */}
            <Link to={createPageUrl('Home')} className="flex items-center gap-2">
              <BrainLogo size={40} />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent hidden sm:block">
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
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
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
                  h-11
                  px-6
                  text-base
                  font-semibold
                  rounded-xl
                  bg-gradient-to-r from-blue-500 to-purple-500
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
          <p>© 2026 Uč se snadně - Učení hrou pro děti</p>
        </div>
      </footer>
       {!loadingUser && user ? <ChatWidget /> : null}
    </div>
  );
}
