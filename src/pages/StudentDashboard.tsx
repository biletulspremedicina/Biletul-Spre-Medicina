import { useEffect, useState, useCallback } from 'react';
import { supabase, type Simulation, type Subscription, type Attempt, type Question } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Clock, CreditCard, Trophy, Calendar, CheckCircle2, XCircle, Loader2, Hourglass, Crown, Sparkles, Archive, LayoutDashboard, RotateCcw, Lock, Info, PlayCircle, AlertTriangle } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';
import PracticeView from '@/pages/PracticeView';

type Props = {
  onStartSimulation: (simulationId: string, archive?: boolean) => void;
  onViewResults: (simulationId: string) => void;
};

type SimWithStatus = Simulation & {
  attempt: Attempt | null;
  archiveRetake: Attempt | null;
  status: 'upcoming' | 'open' | 'closed';
};

type Tab = 'dashboard' | 'archive';

export default function StudentDashboard({ onStartSimulation, onViewResults }: Props) {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [simulations, setSimulations] = useState<SimWithStatus[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingSub, setBuyingSub] = useState(false);
  const [subPrice, setSubPrice] = useState(30);
  const [practiceSimId, setPracticeSimId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data: sims } = await supabase
      .from('simulations')
      .select('*')
      .order('start_at', { ascending: false });

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

    setAttempts(atts || []);

    const now = new Date();
    const activeSub = (subs || []).find(
      (s) => s.status === 'active' && new Date(s.end_at) > now
    ) as Subscription | undefined;
    setSubscription(activeSub || null);

    const enriched: SimWithStatus[] = (sims || []).map((sim) => {
      const simAttempts = (atts || []).filter((a) => a.simulation_id === sim.id) || [];
      const normalAttempt = simAttempts.find((a) => !a.is_archive_retake) || null;
      const archiveRetake = simAttempts.find((a) => a.is_archive_retake) || null;
      const attempt = normalAttempt || archiveRetake;
      const start = new Date(sim.start_at);
      const end = new Date(sim.end_at);
      let status: SimWithStatus['status'] = 'upcoming';
      if (now >= start && now <= end) status = 'open';
      else if (now > end) status = 'closed';
      return { ...sim, attempt, status, archiveRetake };
    });

    setSimulations(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleBuySubscription = async () => {
    if (!profile) return;
    setBuyingSub(true);
    try {
      const startAt = new Date();
      const endAt = new Date();
      endAt.setMonth(endAt.getMonth() + 1);

      await supabase.from('subscriptions').insert({
        user_id: profile.id,
        status: 'active',
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        amount_ron: subPrice,
      });
      await loadDashboard();
    } catch (err) {
      console.error('Subscription error:', err);
    } finally {
      setBuyingSub(false);
    }
  };

  if (loading) return <Loading message="Se încarcă simulările..." />;

  if (practiceSimId) {
    return (
      <PracticeView
        simulationId={practiceSimId}
        onExit={() => setPracticeSimId(null)}
      />
    );
  }

  const upcoming = simulations.filter((s) => s.status === 'upcoming');
  const open = simulations.filter((s) => s.status === 'open');
  const closed = simulations.filter((s) => s.status === 'closed');
  const completedAttempts = attempts.filter((a) => a.submitted_at);
  const hasActiveSub = !!subscription;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
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
        {/* Tab navigation */}
        <div className="mb-6 flex gap-1 rounded-xl bg-stone-100 p-1">
          <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<LayoutDashboard size={16} />}>
            Simulări
          </TabButton>
          <TabButton active={tab === 'archive'} onClick={() => setTab('archive')} icon={<Archive size={16} />}>
            Arhivă simulări
          </TabButton>
        </div>

        {tab === 'archive' ? (
          <ArchiveTab
            closedSims={closed}
            hasActiveSub={hasActiveSub}
            onPractice={(simId) => setPracticeSimId(simId)}
            onViewResults={onViewResults}
            onBuySubscription={handleBuySubscription}
            buyingSub={buyingSub}
            onStartSimulation={onStartSimulation}
          />
        ) : (
          <>
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
                        Acces nelimitat la toate simulările cu abonament timp de 30 de zile.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleBuySubscription}
                    disabled={buyingSub}
                    className="btn-accent whitespace-nowrap"
                  >
                    {buyingSub && <Loader2 size={16} className="animate-spin" />}
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
              <StatCard icon={<Trophy />} label="Simulări susținute" value={completedAttempts.length} color="accent" />
              <StatCard icon={<Calendar />} label="Simulări deschise" value={open.length} color="brand" />
              <StatCard icon={<CreditCard />} label="Status abonament" value={hasActiveSub ? 'Activ' : 'Inactiv'} color={hasActiveSub ? 'accent' : 'brand'} />
            </div>

            {/* Open simulations */}
            {open.length > 0 && (
              <Section title="Simulări deschise acum" icon={<Clock />}>
                <div className="grid gap-4">
                  {open.map((sim) => (
                    <SimCard
                      key={sim.id}
                      sim={sim}
                      hasActiveSub={hasActiveSub}
                      onStart={() => onStartSimulation(sim.id)}
                      onViewResults={() => onViewResults(sim.id)}
                      onBuySubscription={handleBuySubscription}
                      buyingSub={buyingSub}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <Section title="Simulări viitoare" icon={<Calendar />}>
                <div className="grid gap-4">
                  {upcoming.map((sim) => (
                    <SimCard
                      key={sim.id}
                      sim={sim}
                      hasActiveSub={hasActiveSub}
                      onStart={() => onStartSimulation(sim.id)}
                      onViewResults={() => onViewResults(sim.id)}
                      onBuySubscription={handleBuySubscription}
                      buyingSub={buyingSub}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* History */}
            {closed.length > 0 && (
              <Section title="Simulări închise recent" icon={<Trophy />}>
                <div className="grid gap-4">
                  {closed.map((sim) => (
                    <SimCard
                      key={sim.id}
                      sim={sim}
                      hasActiveSub={hasActiveSub}
                      onStart={() => onStartSimulation(sim.id)}
                      onViewResults={() => onViewResults(sim.id)}
                      onBuySubscription={handleBuySubscription}
                      buyingSub={buyingSub}
                    />
                  ))}
                </div>
              </Section>
            )}

            {simulations.length === 0 && (
              <div className="card p-12 text-center text-stone-500">
                <Calendar size={40} className="mx-auto mb-4 text-stone-300" />
                <p className="text-lg font-medium">Nu există simulări disponibile momentan.</p>
                <p className="text-sm mt-1">Revino mai târziu pentru simulări noi.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
        active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Archive Tab
// ---------------------------------------------------------------------------
function ArchiveTab({
  closedSims,
  hasActiveSub,
  onPractice,
  onViewResults,
  onBuySubscription,
  buyingSub,
  onStartSimulation,
}: {
  closedSims: SimWithStatus[];
  hasActiveSub: boolean;
  onPractice: (simId: string) => void;
  onViewResults: (simId: string) => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
  onStartSimulation: (simId: string, archive?: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-50 to-stone-50 border border-brand-200 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Archive size={20} />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900">Arhivă simulări</h3>
            <p className="text-sm text-stone-600">
              Toate simulările care s-au încheiat pe platformă. Accesează detaliile sau rezolvă simulările disponibile.
            </p>
          </div>
        </div>
      </div>

      {closedSims.length === 0 ? (
        <div className="card p-12 text-center text-stone-500">
          <Archive size={40} className="mx-auto mb-4 text-stone-300" />
          <p className="text-lg font-medium">Nu există simulări în arhivă încă.</p>
          <p className="text-sm mt-1">După ce simulările se încheie, vor apărea aici pentru refacere.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {closedSims.map((sim) => (
            <ArchiveSimCard
              key={sim.id}
              sim={sim}
              hasAttempt={!!sim.attempt?.submitted_at}
              hasArchiveRetake={!!sim.archiveRetake?.submitted_at}
              hasActiveSub={hasActiveSub}
              onPractice={() => onPractice(sim.id)}
              onViewResults={() => onViewResults(sim.id)}
              onBuySubscription={onBuySubscription}
              buyingSub={buyingSub}
              onStartSimulation={() => onStartSimulation(sim.id, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArchiveSimCard({
  sim,
  hasAttempt,
  hasArchiveRetake,
  hasActiveSub,
  onPractice,
  onViewResults,
  onBuySubscription,
  buyingSub,
  onStartSimulation,
}: {
  sim: SimWithStatus;
  hasAttempt: boolean;
  hasArchiveRetake: boolean;
  hasActiveSub: boolean;
  onPractice: () => void;
  onViewResults: () => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
  onStartSimulation: () => void;
}) {
  const endDate = new Date(sim.end_at);
  const isFree = !sim.requires_subscription;
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-display text-base font-semibold text-stone-900">{sim.title}</h3>
            {/* Free sim badge */}
            {isFree && (
              hasAttempt ? (
                <span className="badge bg-brand-100 text-brand-700"><CheckCircle2 size={12} /> Susținut</span>
              ) : (
                <span className="badge bg-stone-100 text-stone-500">Nesustinut</span>
              )
            )}
            {/* Premium sim badges */}
            {!isFree && hasActiveSub && (
              hasArchiveRetake ? (
                <span className="badge bg-stone-200 text-stone-600"><CheckCircle2 size={12} /> Susținut — Acces unic epuizat</span>
              ) : hasAttempt ? (
                <span className="badge bg-amber-100 text-amber-700"><Crown size={12} /> Susținut · 1 încercare rămasă</span>
              ) : (
                <span className="badge bg-amber-100 text-amber-700"><Crown size={12} /> Abonament activ</span>
              )
            )}
            {!isFree && !hasActiveSub && (
              <span className="badge bg-stone-100 text-stone-500"><Lock size={12} /> Abonament necesar</span>
            )}
          </div>
          {sim.description && (
            <p className="text-sm text-stone-600 mb-2 line-clamp-2">{sim.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {endDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {sim.duration_minutes} min
            </span>
            <span className="flex items-center gap-1">
              {sim.requires_subscription ? <Crown size={13} /> : <Sparkles size={13} />}
              {sim.requires_subscription ? 'Simulare Premium' : 'Fără abonament'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {/* === FREE SIMS: both retake + details for everyone === */}
          {isFree && (
            <>
              <button onClick={onPractice} className="btn-primary">
                <RotateCcw size={16} /> Refă pentru practică
              </button>
              {hasAttempt && (
                <button onClick={onViewResults} className="btn-secondary">
                  Vezi detalii
                </button>
              )}
              <span className="text-xs text-stone-400 flex items-center gap-1">
                <Sparkles size={11} /> Antrenament nelimitat
              </span>
            </>
          )}

          {/* === PREMIUM + SUB + NO RETAKE YET: "Vezi detalii" + "Rezolvă simularea" === */}
          {!isFree && hasActiveSub && !hasArchiveRetake && (
            <>
              {hasAttempt && (
                <button onClick={onViewResults} className="btn-secondary">
                  Vezi detalii
                </button>
              )}
              <button onClick={() => setShowConfirm(true)} className="btn-primary">
                <PlayCircle size={16} /> Rezolvă simularea
              </button>
              {hasAttempt && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Info size={11} /> Mai ai o încercare
                </span>
              )}
            </>
          )}

          {/* === PREMIUM + SUB + RETAKE CONSUMED: only "Vezi detalii" === */}
          {!isFree && hasActiveSub && hasArchiveRetake && (
            <>
              <button onClick={onViewResults} className="btn-secondary">
                Vezi detalii, rezultate și explicații
              </button>
              <span className="text-xs text-stone-500 font-medium">
                Susținut — Acces unic epuizat
              </span>
            </>
          )}

          {/* === PREMIUM + NO SUB: "Cumpără abonament" === */}
          {!isFree && !hasActiveSub && (
            <button
              onClick={onBuySubscription}
              disabled={buyingSub}
              className="btn-accent"
            >
              {buyingSub && <Loader2 size={16} className="animate-spin" />}
              <Crown size={16} /> Cumpără abonament
            </button>
          )}
        </div>
      </div>

      {/* Confirmation dialog before archive retake */}
      {showConfirm && !isFree && hasActiveSub && !hasArchiveRetake && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Confirmă încercarea
              </p>
              <p className="text-xs text-amber-800 mb-3">
                Ai o singură încercare pentru această simulare în arhivă.
                După ce o susții, nu o vei mai putea refăcea, dar vei avea acces
                permanent la rezultate și explicații.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowConfirm(false); onStartSimulation(); }}
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

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-stone-900">
        <span className="text-brand-600">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function SimCard({
  sim,
  hasActiveSub,
  onStart,
  onViewResults,
  onBuySubscription,
  buyingSub,
}: {
  sim: SimWithStatus;
  hasActiveSub: boolean;
  onStart: () => void;
  onViewResults: () => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
}) {
  const needsSub = sim.requires_subscription;
  const canAccess = !needsSub || hasActiveSub;
  const hasAttempt = !!sim.attempt?.submitted_at;
  const hasInProgress = !!sim.attempt && !sim.attempt.submitted_at;
  const isOpen = sim.status === 'open';
  const isClosed = sim.status === 'closed';

  const startDate = new Date(sim.start_at);

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-display text-base font-semibold text-stone-900">{sim.title}</h3>
            <StatusBadge sim={sim} canAccess={canAccess} hasAttempt={hasAttempt} />
          </div>
          {sim.description && (
            <p className="text-sm text-stone-600 mb-2 line-clamp-2">{sim.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {startDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {sim.duration_minutes} min
            </span>
            <span className="flex items-center gap-1">
              {needsSub ? <Crown size={13} /> : <Sparkles size={13} />}
              {needsSub ? 'Necesită abonament' : 'Fără abonament'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {needsSub && !hasActiveSub && !hasAttempt && !hasInProgress && !isClosed && (
            <button onClick={onBuySubscription} disabled={buyingSub} className="btn-accent">
              {buyingSub && <Loader2 size={16} className="animate-spin" />}
              <Crown size={16} /> Cumpără abonament
            </button>
          )}
          {canAccess && !hasAttempt && !hasInProgress && isOpen && (
            <button onClick={onStart} className="btn-primary">
              Start Simulare
            </button>
          )}
          {canAccess && hasInProgress && isOpen && (
            <button onClick={onStart} className="btn-primary">
              Continuă simularea
            </button>
          )}
          {canAccess && !hasAttempt && !hasInProgress && !isOpen && !isClosed && (
            <CountdownBadge startDate={startDate} status={sim.status} />
          )}
          {needsSub && !hasActiveSub && !hasAttempt && isClosed && (
            <span className="text-sm text-stone-400">Fereastră închisă</span>
          )}
          {hasAttempt && isClosed && (
            <button onClick={onViewResults} className="btn-secondary">
              Vezi rezultate
            </button>
          )}
          {hasAttempt && !isClosed && (
            <span className="text-sm text-stone-500">Rezultatele se deblochează după închiderea ferestrei</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ sim, canAccess, hasAttempt }: { sim: SimWithStatus; canAccess: boolean; hasAttempt: boolean }) {
  if (hasAttempt) {
    return <span className="badge bg-brand-100 text-brand-700"><CheckCircle2 size={12} /> Susținut</span>;
  }
  if (sim.requires_subscription && !canAccess) {
    return <span className="badge bg-stone-100 text-stone-600"><Crown size={12} /> Abonament necesar</span>;
  }
  if (sim.requires_subscription && canAccess) {
    return <span className="badge bg-amber-100 text-amber-700"><Crown size={12} /> Abonament activ</span>;
  }
  return <span className="badge bg-brand-100 text-brand-700"><Sparkles size={12} /> Fără abonament</span>;
}

function CountdownBadge({ startDate, status }: { startDate: Date; status: SimWithStatus['status'] }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (status === 'closed') {
    return <span className="text-sm text-stone-400">Fereastră închisă</span>;
  }

  const diff = startDate.getTime() - now;
  if (diff <= 0) {
    return <span className="text-sm text-brand-600 font-medium">Disponibilă acum</span>;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const timeStr =
    days > 0
      ? `${days}z ${hours}h ${minutes}m`
      : hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
        <Hourglass size={13} />
        Disponibilă în {timeStr}
      </span>
      <span className="text-xs text-stone-500">
        Începe la: {startDate.toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
    </div>
  );
}
