import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import { Loader2 } from 'lucide-react';

type Props = {
  mode: 'signin' | 'signup';
  onSuccess: () => void;
  onSwitchMode: (mode: 'signin' | 'signup') => void;
  onBack: () => void;
};

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignup) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        // Auto sign in after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onSuccess();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onSuccess();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'A apărut o eroare';
      if (msg.includes('Invalid login')) {
        setError('Email sau parolă incorectă.');
      } else if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Acest email este deja înregistrat. Încearcă să te autentifici.');
      } else if (msg.includes('password') && msg.includes('at least')) {
        setError('Parola trebuie să aibă cel puțin 6 caractere.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50 to-stone-50">
      <header className="px-4 sm:px-6 lg:px-8 py-5">
        <div className="mx-auto max-w-7xl">
        <button onClick={onBack} className="btn-ghost">
          ← Înapoi
        </button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 sm:px-6 lg:px-8 pb-20">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-4">
            <Logo size="lg" />
            <h1 className="font-display text-2xl font-bold text-stone-900">
              {isSignup ? 'Creează cont' : 'Bine ai revenit'}
            </h1>
            <p className="text-sm text-stone-600 text-center">
              {isSignup
                ? 'Înregistrează-te pentru a accesa simulările de admitere.'
                : 'Autentifică-te pentru a continua la simulări.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {isSignup && (
              <div>
                <label className="label" htmlFor="fullName">Nume complet</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  placeholder="Ion Popescu"
                  required
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="ion@example.com"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Parolă</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Minim 6 caractere"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 size={18} className="animate-spin" />}
              {isSignup ? 'Creează cont' : 'Autentifică-te'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-600">
            {isSignup ? 'Ai deja cont? ' : 'Nu ai cont? '}
            <button
              onClick={() => onSwitchMode(isSignup ? 'signin' : 'signup')}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              {isSignup ? 'Autentifică-te' : 'Creează cont'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
