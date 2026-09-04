import { useEffect, useState, useCallback } from 'react';
import { supabase, type Simulation, type Subscription, type Attempt } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Clock, CreditCard, Trophy, CheckCircle2, XCircle, Crown, Sparkles, Archive, RotateCcw, Lock, PlayCircle, AlertTriangle, BookOpen } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  onStartSimulation: (simulationId: string) => void;
  onViewResults: (simulationId: string, attemptId?: string) => void;
};

type SimWithStatus = Simulation & {
  attempts: Attempt[];
  hasSubmitted: boolean;
  hasInProgress: boolean;
};

export default function StudentDashboard({ onStartSimulation, onViewResults }: Props) {
  const { profile, signOut } = useAuth();
  const [simulations, setSimulations] = useState<SimWithStatus[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subPrice, setSubPrice] = useState(30);

  const loadDashboard = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data: sims } = await supabase
      .from('simulations')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .order('end_at', { ascending: false });

    const { data: atts } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', profile.id);

    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (settings) setSubPrice(Number(settings.subscription_price_ron));

    const now = new Date();
    const activeSub = (subs || []).find(
      (s) => s.status === 'active' && new Date(s.end_at) > now
    ) as Subscription | undefined;
    setSubscription(activeSub || null);

    const enriched: SimWithStatus[] = (sims || []).map((sim) => {
      const simAttempts = (atts || []).filter((a) => a.simulation_id === sim.id) || [];
      const hasSubmitted = simAttempts.some((a) => a.submitted_at);
      const hasInProgress = simAttempts.some((a) => !a.submitted_at);
      return {
        ...(sim as Simulation),
        attempts: simAttempts,
        hasSubmitted,
        hasInProgress,
      };
    });

    setSimulations(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) return <Loading message="Se încarcă simulările..." />;

  const hasActiveSub = !!subscription;
  const completedCount = simulations.reduce((sum, s) => sum + s.attempts.filter((a) => a.submitted_at).length, 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            {hasActiveSub ? (
              <span className="badge bg-amber-100 text-amber-700">
                <Crown size={12} /> Abonament activ
              </span>
            ) : (
              <span className="badge bg-stone-100 text-stone-500">
                <XCircle size={12} /> Fără abonament
              </span>
            )}
            <span className="text-sm text-stone-600 hidden sm:inline">
              {profile?.full_name || profile?.email}
            </span>
            <button onClick={signOut} className="btn-ghost">Deconectare</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Subscription banner */}
        {!hasActiveSub && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <Crown size={24} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-stone-900">
                    Abonament lunar — {subPrice} RON/lună
                  </h3>
                  <p className="text-sm text-stone-600">
                    Acces la toate simulările cu abonament timp de 30 de zile.
                  </p>
                </div>
              </div>
              <button className="btn-accent whitespace-nowrap" disabled>
                <Crown size={16} /> Cumpără abonament
              </button>
            </div>
          </div>
        )}

        {hasActiveSub && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-brand-50 to-emerald-50 border border-brand-200 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Crown size={20} />
              </div>
              <div>
                <p className="font-semibold text-stone-900">Abonament activ</p>
                <p className="text-sm text-stone-600">
                  Valabil până la: {new Date(subscription!.end_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard icon={<Archive />} label="Simulări disponibile" value={simulations.length} color="brand" />
          <StatCard icon={<Trophy />} label="Simulări susținute" value={completedCount} color="accent" />
          <StatCard icon={<CreditCard />} label="Status abonament" value={hasActiveSub ? 'Activ' : 'Inactiv'} color={hasActiveSub ? 'accent' : 'brand'} />
        </div>

        {/* Archive header */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-50 to-stone-50 border border-brand-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Archive size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-stone-900">Arhivă simulări</h3>
              <p className="text-sm text-stone-600">
                Toate simulările disponibile pe platformă. Rezolvă și vezi instant rezultatele și explicațiile.
              </p>
            </div>
          </div>
        </div>

        {/* Simulation cards */}
        {simulations.length === 0 ? (
          <div className="card p-12 text-center text-stone-500">
            <Archive size={40} className="mx-auto mb-4 text-stone-300" />
            <p className="text-lg font-medium">Nu există simulări disponibile momentan.</p>
            <p className="text-sm mt-1">Revino mai târziu pentru simulări noi.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {simulations.map((sim) => (
              <ArchiveSimCard
                key={sim.id}
                sim={sim}
                hasActiveSub={hasActiveSub}
                onStart={() => onStartSimulation(sim.id)}
                onViewResults={(attemptId) => onViewResults(sim.id, attemptId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: 'brand' | 'accent' }) {
  const bg = color === 'brand' ? 'bg-brand-100 text-brand-600' : 'bg-accent-100 text-accent-600';
  return (
    <div className="card p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  );
}

function ArchiveSimCard({
  sim,
  hasActiveSub,
  onStart,
  onViewResults,
}: {
  sim: SimWithStatus;
  hasActiveSub: boolean;
  onStart: () => void;
  onViewResults: (attemptId?: string) => void;
}) {
  const isFree = !sim.requires_subscription;
  const submittedAttempts = sim.attempts.filter((a) => a.submitted_at);
  const hasSubmitted = submittedAttempts.length > 0;
  const hasInProgress = sim.attempts.some((a) => !a.submitted_at);
  const latestAttempt = submittedAttempts[0];
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-display text-base font-semibold text-stone-900">{sim.title}</h3>
            {isFree ? (
              hasSubmitted ? (
                <span className="badge bg-brand-100 text-brand-700">
                  <CheckCircle2 size={12} /> Susținut ({submittedAttempts.length}x)
                </span>
              ) : (
                <span className="badge bg-stone-100 text-stone-500">Nesusținut</span>
              )
            ) : hasSubmitted ? (
              <span className="badge bg-stone-200 text-stone-600">
                <CheckCircle2 size={12} /> Susținut
              </span>
            ) : hasActiveSub ? (
              <span className="badge bg-amber-100 text-amber-700">
                <Crown size={12} /> Abonament activ
              </span>
            ) : (
              <span className="badge bg-stone-100 text-stone-500">
                <Lock size={12} /> Abonament necesar
              </span>
            )}
          </div>
          {sim.description && (
            <p className="text-sm text-stone-600 mb-2 line-clamp-2">{sim.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <BookOpen size={13} />
              {sim.duration_minutes} min
            </span>
            <span className="flex items-center gap-1">
              {isFree ? <Sparkles size={13} /> : <Crown size={13} />}
              {isFree ? 'Fără abonament' : 'Necesită abonament'}
            </span>
            {hasInProgress && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Clock size={13} /> Încercare în curs
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {/* FREE sims: always show "Rezolvă simularea" + "Detalii" after first attempt */}
          {isFree && (
            <>
              <button onClick={onStart} className="btn-primary">
                {hasInProgress ? (
                  <><PlayCircle size={16} /> Continuă simularea</>
                ) : hasSubmitted ? (
                  <><RotateCcw size={16} /> Rezolvă din nou</>
                ) : (
                  <><PlayCircle size={16} /> Rezolvă simularea</>
                )}
              </button>
              {hasSubmitted ? (
                <button onClick={() => onViewResults(latestAttempt?.id)} className="btn-secondary">
                  <BookOpen size={16} /> Detalii simulare
                </button>
              ) : (
                <span className="text-xs text-stone-400 flex items-center gap-1">
                  <Lock size={11} /> Disponibil după prima rezolvare
                </span>
              )}
              <span className="text-xs text-stone-400 flex items-center gap-1">
                <Sparkles size={11} /> Antrenament nelimitat
              </span>
            </>
          )}

          {/* PREMIUM + has submitted: only "Detalii" */}
          {!isFree && hasSubmitted && (
            <>
              <button onClick={() => onViewResults(latestAttempt?.id)} className="btn-secondary">
                <BookOpen size={16} /> Detalii simulare
              </button>
              <span className="text-xs text-stone-500 font-medium">
                Susținut — o singură încercare
              </span>
            </>
          )}

          {/* PREMIUM + sub + no attempt: "Rezolvă simularea" with confirmation */}
          {!isFree && hasActiveSub && !hasSubmitted && (
            <>
              <button onClick={() => setShowConfirm(true)} className="btn-primary">
                <PlayCircle size={16} /> Rezolvă simularea
              </button>
              {hasInProgress && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Clock size={11} /> Continuă încercarea în curs
                </span>
              )}
            </>
          )}

          {/* PREMIUM + no sub: "Cumpără abonament" (informational only) */}
          {!isFree && !hasActiveSub && !hasSubmitted && (
            <button className="btn-accent" disabled title="Sistemul de plată va fi disponibil în curând">
              <Crown size={16} /> Cumpără abonament pentru a accesa
            </button>
          )}
        </div>
      </div>

      {/* Confirmation dialog for premium */}
      {showConfirm && !isFree && hasActiveSub && !hasSubmitted && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Confirmă începerea simulării
              </p>
              <p className="text-xs text-amber-800 mb-3">
                Aceasta este o simulare cu abonament și se poate susține o <strong>singură dată</strong>.
                Cronometrul pornește la apăsarea butonului „Start" și nu poate fi oprit.
                La expirarea timpului, răspunsurile se trimit automat.
                Dacă închizi pagina, poți continua cu timpul rămas.
                După finalizare, vei vedea instant rezultatele și explicațiile, iar accesul rămâne permanent.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowConfirm(false); onStart(); }}
                  className="btn-primary text-sm"
                >
                  <PlayCircle size={14} /> Începe acum
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="btn-ghost text-sm"
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
