import { useEffect, useState, type FormEvent } from 'react';
import { Crown, Loader2, Lock, Monitor, Moon, Settings2, Sun } from 'lucide-react';
import { supabase, type Profile, type Subscription } from '@/lib/supabase';

type StudentSettingsProps = {
  profile: Profile | null;
  subscription: Subscription | null;
  subscriptionHistory: Subscription[];
  onRefreshProfile: () => Promise<void>;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
};

const DAY_MS = 86_400_000;
const serif = { fontFamily: 'Georgia, Cambria, "Times New Roman", serif' };

export default function StudentSettings({
  profile, subscription, subscriptionHistory, onRefreshProfile, theme, onThemeChange,
}: StudentSettingsProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setFullName(profile?.full_name || ''), [profile?.full_name]);

  const formatDate = (value: string) => new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest',
  }).format(new Date(value));
  const inputClass = 'mt-2 w-full rounded-xl border border-[#dbe6e2] bg-white px-4 py-3 text-sm text-[#173b31] outline-none transition-colors focus:border-[#3b9676] focus:ring-2 focus:ring-[#3b9676]/15';
  const remainingDays = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.end_at).getTime() - Date.now()) / DAY_MS))
    : 0;

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const normalized = fullName.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > 80) {
      setNameMessage({ ok: false, text: 'Numele trebuie să aibă între 2 și 80 de caractere.' });
      return;
    }
    setSavingName(true);
    setNameMessage(null);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: normalized }).eq('id', profile.id);
      if (error) throw error;
      await onRefreshProfile();
      setNameMessage({ ok: true, text: 'Numele a fost actualizat.' });
    } catch (error) {
      console.error('Profile update error:', error);
      setNameMessage({ ok: false, text: 'Nu am putut salva numele. Încearcă din nou.' });
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setPasswordMessage({ ok: false, text: 'Parola trebuie să aibă cel puțin 8 caractere.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ ok: false, text: 'Parolele introduse nu coincid.' });
      return;
    }
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ ok: true, text: 'Parola a fost schimbată cu succes.' });
    } catch (error) {
      console.error('Password update error:', error);
      setPasswordMessage({ ok: false, text: 'Nu am putut schimba parola. Reautentifică-te și încearcă din nou.' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!profile) {
    return (
      <div className="rounded-[18px] border border-dashed border-[#cddfd5] bg-white p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#edf7f2] text-[#1a775a]"><Settings2 size={36} /></div>
        <h2 className="mt-5 text-lg font-bold text-[#183d32]">Nu am putut încărca setările contului.</h2>
        <p className="mt-2 text-sm text-[#6c7f8b]">Reîncarcă pagina și încearcă din nou.</p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-7 flex items-start gap-4 rounded-[18px] border border-[#d8eae1] bg-[#f5fbf8] p-5 sm:p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e0f3e9] text-[#0f6d52]"><Settings2 size={27} /></span>
        <div>
          <h1 className="text-[29px] font-bold leading-tight text-[#163c32]" style={serif}>Setări</h1>
          <p className="mt-1 text-sm text-[#617587]">Administrează datele contului și urmărește abonamentul tău.</p>
        </div>
      </div>
      <div className="mb-5 rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-[0_5px_22px_rgba(25,65,49,0.04)] sm:p-6">
        <h2 className="font-display text-lg font-bold text-[#173b31]">Aspectul platformei</h2>
        <p className="mt-1 text-sm text-[#728479]">Alege cum arată zona ta de studiu pe acest dispozitiv.</p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3" role="group" aria-label="Tema platformei">
          {([
            { value: 'light', label: 'Luminoasă', icon: <Sun size={20} /> },
            { value: 'dark', label: 'Întunecată', icon: <Moon size={20} /> },
            { value: 'system', label: 'După sistem', icon: <Monitor size={20} /> },
          ] as const).map((option) => (
            <button key={option.value} type="button" onClick={() => onThemeChange(option.value)}
              aria-pressed={theme === option.value}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                theme === option.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300 hover:bg-stone-50'
              }`}>
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-start">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-[0_5px_22px_rgba(25,65,49,0.04)] sm:p-6">
            <div className="flex items-center gap-3 border-b border-[#e8efeb] pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f5ed] text-[#14674e]">
                <Settings2 size={21} />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-[#173b31]">Datele contului</h2>
                <p className="text-xs text-[#728479]">Membru din {formatDate(profile.created_at)}</p>
              </div>
            </div>
            <form onSubmit={saveName} className="mt-5">
              <label htmlFor="settings-full-name" className="text-sm font-semibold text-[#244638]">Nume afișat</label>
              <input id="settings-full-name" type="text" autoComplete="name" maxLength={80}
                value={fullName} onChange={(event) => setFullName(event.target.value)}
                className={inputClass} />
              <div className="mt-4">
                <p className="text-sm font-semibold text-[#244638]">Adresă de e-mail</p>
                <p className="mt-2 rounded-xl border border-[#e5ece8] bg-[#f8faf9] px-4 py-3 text-sm text-[#64766d]">
                  {profile.email}
                </p>
                <p className="mt-2 text-xs text-[#829087]">Pentru schimbarea adresei de e-mail, contactează-ne prin asistență.</p>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={savingName || fullName.trim() === profile.full_name}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                  {savingName && <Loader2 size={16} className="animate-spin" />}
                  Salvează numele
                </button>
                {nameMessage && <p role="status" className={`text-xs ${nameMessage.ok ? 'text-[#176c50]' : 'text-red-600'}`}>
                  {nameMessage.text}
                </p>}
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-[0_5px_22px_rgba(25,65,49,0.04)] sm:p-6">
            <div className="flex items-center gap-3 border-b border-[#e8efeb] pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff2dc] text-[#b77a13]">
                <Lock size={20} />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-[#173b31]">Securitate</h2>
                <p className="text-xs text-[#728479]">Schimbă parola contului tău.</p>
              </div>
            </div>
            <form onSubmit={savePassword} className="mt-5 space-y-4">
              <div>
                <label htmlFor="settings-new-password" className="text-sm font-semibold text-[#244638]">Parolă nouă</label>
                <input id="settings-new-password" type="password" autoComplete="new-password" minLength={8}
                  value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label htmlFor="settings-confirm-password" className="text-sm font-semibold text-[#244638]">Confirmă parola</label>
                <input id="settings-confirm-password" type="password" autoComplete="new-password" minLength={8}
                  value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                  className={inputClass} />
              </div>
              <p className="text-xs text-[#829087]">Folosește cel puțin 8 caractere și o parolă pe care nu o utilizezi în altă parte.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={savingPassword || !newPassword || !confirmPassword}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                  {savingPassword && <Loader2 size={16} className="animate-spin" />}
                  Schimbă parola
                </button>
                {passwordMessage && <p role="status" className={`text-xs ${passwordMessage.ok ? 'text-[#176c50]' : 'text-red-600'}`}>
                  {passwordMessage.text}
                </p>}
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-[#cfe4d9] bg-white shadow-[0_5px_22px_rgba(25,65,49,0.04)]">
            <div className="bg-[linear-gradient(120deg,#0a4b3a,#176a4e)] p-6 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#c9ecda]">
                <Crown size={19} /> Abonamentul meu
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold">
                {subscription ? 'Abonament activ' : 'Fără abonament activ'}
              </h2>
              <p className="mt-2 text-sm text-[#e1f4e9]">
                {subscription
                  ? `Valabil până la ${formatDate(subscription.end_at)}`
                  : 'Poți continua să folosești materialele gratuite.'}
              </p>
            </div>
            <div className="p-5 sm:p-6">
              {subscription ? (
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-[#708077]">Zile rămase</dt><dd className="font-bold text-[#174a38]">{remainingDays}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-[#708077]">Început</dt><dd className="text-right font-semibold text-[#244638]">{formatDate(subscription.start_at)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-[#708077]">Sfârșit</dt><dd className="text-right font-semibold text-[#244638]">{formatDate(subscription.end_at)}</dd></div>
                  <div className="flex justify-between gap-3 border-t border-[#e7efea] pt-3"><dt className="text-[#708077]">Valoare înregistrată</dt><dd className="font-semibold text-[#244638]">{Number(subscription.amount_ron).toLocaleString('ro-RO')} lei</dd></div>
                </dl>
              ) : (
                <p className="text-sm leading-relaxed text-[#687b70]">Detaliile abonamentului tău vor apărea aici după activare.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-[0_5px_22px_rgba(25,65,49,0.04)] sm:p-6">
            <h2 className="font-display text-lg font-bold text-[#173b31]">Istoricul abonamentelor</h2>
            <p className="mt-1 text-xs text-[#728479]">Perioadele înregistrate pentru contul tău.</p>
            {subscriptionHistory.length ? (
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {subscriptionHistory.map((item) => {
                  const active = item.status === 'active' && new Date(item.end_at) > new Date();
                  return (
                    <li key={item.id} className="rounded-xl border border-[#e4ece7] bg-[#fbfdfb] px-3 py-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#244638]">{formatDate(item.start_at)}</span>
                        <span className={active ? 'font-semibold text-[#16805b]' : 'text-[#86928b]'}>
                          {active ? 'Activ' : 'Expirat'}
                        </span>
                      </div>
                      <p className="mt-1 text-[#728077]">Până la {formatDate(item.end_at)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-4 text-sm text-[#728077]">Nu există încă abonamente înregistrate.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
