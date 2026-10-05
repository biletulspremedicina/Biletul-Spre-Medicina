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
  'Facebook',
  'Google',
  'Yahoo',
] as const;

type SocialProvider = typeof socialProviders[number];

function SocialIcon({ provider }: { provider: SocialProvider }) {
  if (provider === 'Facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="#1877f2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  if (provider === 'Google') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.24 5.48-4.74 7.18l7.73 6c4.51-4.16 7.05-10.29 7.05-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.95-6.19A23.97 23.97 0 0 0 0 24c0 3.87.92 7.52 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.89-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.3 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#6001d2" />
      <path d="M5.5 8.5h5.1l5.1 7.8 5.1-7.8h5.1l-8 12.1v4h-4.5v-4L5.5 8.5z" fill="#fff" />
      <path d="M24.6 15.9h2.6l-.5 6.3h-1.6l-.5-6.3z" fill="#fff" />
      <circle cx="25.9" cy="24.3" r="1.3" fill="#fff" />
    </svg>
  );
}

export default function AuthPage({ mode, onSuccess, onSwitchMode, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isSignup && password !== confirmPassword) {
      setError('Parolele nu coincid. Verifică-le și încearcă din nou.');
      return;
    }
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
    <main className={`auth-page${isSignup ? ' auth-page--signup' : ''}`}>
      {!isSignup && (
        <button type="button" className="auth-page__back" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Înapoi la pagina principală</span>
        </button>
      )}

      <section className="auth-card" aria-labelledby="auth-title">
        {isSignup && (
          <button type="button" className="auth-card__back" onClick={onBack} aria-label="Înapoi la pagina principală">
            <ArrowLeft size={19} aria-hidden="true" />
          </button>
        )}
        <div className="auth-card__brand"><Logo showText linked={false} /></div>

        <div className="auth-card__intro">
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
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
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

          {isSignup && (
            <div className="auth-form__field">
              <label htmlFor="auth-confirm-password">Confirmă parola</label>
              <div className="auth-form__password">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  placeholder="Introdu parola din nou"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="auth-form__reveal"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Ascunde parola confirmată' : 'Afișează parola confirmată'}
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
          )}

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
          <div className="auth-card__social-options">
            {socialProviders.map((provider) => (
              // Butoanele sociale sunt doar UI; conectarea se poate atașa ulterior.
              <button
                key={provider}
                type="button"
                className="auth-card__social-button"
                title="Funcție de configurat"
              >
                <span className="auth-card__social-mark"><SocialIcon provider={provider} /></span>
                <span>{provider}</span>
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
