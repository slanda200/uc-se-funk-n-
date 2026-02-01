import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function UsernameModal({ open, onClose, userId }) {
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const usernameError = useMemo(() => {
    const u = (username || '').trim();
    if (!u) return 'Zadej uživatelské jméno.';
    if (u.length < 3) return 'Minimálně 3 znaky.';
    if (u.length > 20) return 'Max 20 znaků.';
    if (!/^[a-zA-Z0-9_.]+$/.test(u)) return 'Jen písmena, čísla, "_" a "."';
    return '';
  }, [username]);

  const save = async () => {
    setLoading(true);
    setMsg('');
    try {
      if (!userId) throw new Error('Chybí user id');
      if (usernameError) {
        setMsg(usernameError);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .insert([{ user_id: userId, username: username.trim() }]);

      if (error) {
        if (error.code === '23505') throw new Error('Toto jméno už existuje.');
        throw error;
      }

      onClose?.();
    } catch (e) {
      setMsg(e?.message || 'Nepodařilo se uložit username.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-2">Vyber si uživatelské jméno</h2>
        <p className="text-sm text-slate-500 mb-4">
          Abychom tě mohli zobrazit v žebříčku, nastav si username.
        </p>

        <div className="space-y-3">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="např. Filip_19"
            disabled={loading}
          />

          {msg && (
            <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">
              {msg}
            </div>
          )}

          <Button
            onClick={save}
            disabled={loading || !!usernameError}
            className="w-full h-12 text-base font-semibold rounded-xl"
          >
            Uložit
          </Button>
        </div>
      </div>
    </div>
  );
}
