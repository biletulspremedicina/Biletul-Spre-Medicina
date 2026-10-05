import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import SupportChat from '@/components/SupportChat';
import './AuthPage.css';

type Props = {
  mode: 'signin' | 'signup';
  onSuccess: () => void;
  onSwitchMode: (mode: 'signin' | 'signup') => void;
  onBack: () => void;
};

const socialProviders = [
  { name: 'Facebook', mark: 'f', className: 'facebook' },
  { name: 'Google', mark: 'G', className: 'google' },
  { name: 'Yahoo', mark: 'Y!', className: 'yahoo' },
];

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="auth-page">
      <button type="button" className="auth-page__back" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Înapoi la pagina principală</span>
      </button>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__brand"><Logo showText linked={false} /></div>

        <div className="auth-card__intro">
          <p className="auth-card__eyebrow">Contul tău</p>
          <h1 id="auth-title">{isSignup ? 'Creează-ți contul' : 'Bine ai revenit'}</h1>
          <p>{isSignup ? 'Începe pregătirea pentru admitere.' : 'Continuă pregătirea de unde ai rămas.'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignup && (
            <div className="auth-form__field">
              <label htmlFor="auth-full-name">Nume complet</label>
              <input
                id="auth-full-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Numele tău complet"
                required
              />
            </div>
          )}

          <div className="auth-form__field">
            <label htmlFor="auth-email">E-mail</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Introdu e-mailul tău"
              required
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="auth-password">Parolă</label>
            <div className="auth-form__password">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? 'Minimum 6 caractere' : 'Introdu parola'}
                required
                minLength={6}
              />
              <button
                type="button"
                className="auth-form__reveal"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ascunde parola' : 'Afișează parola'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          {error && <p className="auth-form__error" role="alert">{error}</p>}

          <button type="submit" disabled={loading} className="auth-form__submit">
            {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {isSignup ? 'Creează cont' : 'Mă conectez'}
          </button>
        </form>

        {!isSignup && (
          <button type="button" className="auth-card__forgot" title="Funcție de configurat">
            Ai uitat parola?
          </button>
        )}

        <div className="auth-card__social">
          <p>Sau continuă cu</p>
          <div className="auth-card__social-options">
            {socialProviders.map((provider) => (
              // Butoanele sociale sunt doar UI; conectarea se poate atașa ulterior.
              <button
                key={provider.name}
                type="button"
                className="auth-card__social-button"
                title="Funcție de configurat"
              >
                <span className={`auth-card__social-mark auth-card__social-mark--${provider.className}`} aria-hidden="true">
                  {provider.mark}
                </span>
                <span>{provider.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="auth-card__footer">
          <span>{isSignup ? 'Ai deja cont?' : 'Nu ai cont?'}</span>
          <button type="button" onClick={() => { setError(null); onSwitchMode(isSignup ? 'signin' : 'signup'); }}>
            {isSignup ? 'Autentifică-te' : 'Creează-ți cont'}
          </button>
        </div>
      </section>

      <SupportChat />
    </main>
  );
}
