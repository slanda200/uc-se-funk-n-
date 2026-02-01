import React, { useMemo, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function LoginModal({ open, onClose }) {
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(''); // username při signup
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // autofocus pro Chrome autofill UX
  const emailRef = useRef(null);

  // ✅ Hooks musí běžet vždy – takže už žádný early return PŘED useMemo
  const usernameError = useMemo(() => {
    if (mode !== 'signup') return '';
    const u = (username || '').trim();

    if (!u) return 'Zadej uživatelské jméno.';
    if (u.length < 3) return 'Uživatelské jméno musí mít alespoň 3 znaky.';
    if (u.length > 20) return 'Uživatelské jméno může mít max 20 znaků.';
    if (!/^[a-zA-Z0-9_.]+$/.test(u)) return 'Použij jen písmena, čísla, "_" a "."';
    return '';
  }, [mode, username]);

  const canSubmit = useMemo(() => {
    if (!email || !password) return false;
    if (mode === 'signup') return !usernameError;
    return true;
  }, [email, password, mode, usernameError]);

  // když se modal otevře → focus + vyčistit msg (ať se nezobrazují staré chyby)
  useEffect(() => {
    if (!open) return;
    setMsg('');
    setLoading(false);
    // delay, ať se inputy stihnou vyrenderovat
    setTimeout(() => emailRef.current?.focus?.(), 0);
  }, [open]);

  const signInWithGoogle = async () => {
    setLoading(true);
    setMsg('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // OAuth flow přesměruje stránku
    } catch (e) {
      setMsg(e?.message || 'Nepodařilo se přihlásit přes Google.');
      setLoading(false);
    }
  };

  const ensureProfileForUser = async ({ userId, usernameValue }) => {
    const cleanUsername = (usernameValue || '').trim();

    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ user_id: userId, username: cleanUsername }]);

    if (!insertError) return;

    // username obsazený
    if (insertError.code === '23505') {
      throw new Error('Toto uživatelské jméno je už obsazené.');
    }

    // fallback: pokud profil už existuje pro user_id, ignoruj
    const { data: existing, error: selErr } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!selErr && existing?.user_id) return;

    throw insertError;
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (loading) return;

    setLoading(true);
    setMsg('');

    try {
      if (mode === 'signup') {
        if (usernameError) {
          setMsg(usernameError);
          return;
        }

        // 1) auth signup
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        const userId = data?.user?.id;
        if (!userId) throw new Error('Registrace proběhla, ale chybí user id.');

        // 2) profiles insert
        await ensureProfileForUser({ userId, usernameValue: username });

        setMsg('Registrace hotová. Pokud máš zapnuté potvrzení e-mailu, mrkni do inboxu.');
        // volitelně po signup můžeš modal zavřít nebo přepnout na login:
        // setMode('login');
        // onClose?.();
      } else {
        // login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        onClose?.();
      }
    } catch (e2) {
      setMsg(e2?.message || 'Něco se pokazilo.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ podmíněný return AŽ PO HOOKÁCH
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !loading && onClose?.()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {mode === 'login' ? 'Přihlášení' : 'Registrace'}
          </h2>
          <button
            onClick={() => !loading && onClose?.()}
            className="text-slate-500 hover:text-slate-800"
            aria-label="Zavřít"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* Google */}
          <Button
            onClick={signInWithGoogle}
            variant="outline"
            disabled={loading}
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            Pokračovat s Google
          </Button>

          <div className="relative my-1 text-center text-sm text-slate-400">
            <span className="bg-white px-2">nebo</span>
          </div>

          {/* ✅ FORM = Chrome uložit heslo + autofill */}
          <form onSubmit={submit} className="space-y-3">
            {/* Username při signup */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <Input
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Uživatelské jméno"
                  autoComplete="nickname"
                  disabled={loading}
                />
                {usernameError && <div className="text-xs text-red-600">{usernameError}</div>}
              </div>
            )}

            {/* Email */}
            <Input
              ref={emailRef}
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              disabled={loading}
            />

            {/* Password */}
            <Input
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Heslo"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={loading}
            />

            {msg && (
              <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">
                {msg}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {mode === 'login' ? 'Přihlásit' : 'Registrovat'}
            </Button>
          </form>

          <div className="text-sm text-center text-slate-600">
            {mode === 'login' ? (
              <>
                Nemáš účet?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => setMode('signup')}
                  disabled={loading}
                >
                  Zaregistrovat
                </button>
              </>
            ) : (
              <>
                Už máš účet?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => setMode('login')}
                  disabled={loading}
                >
                  Přihlásit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;
