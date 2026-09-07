import { useEffect, useState, useCallback } from 'react';
import { supabase, type Simulation, type Subscription, type Attempt } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  Clock, CreditCard, Trophy, CheckCircle2, Crown, Sparkles,
  Archive, RotateCcw, Lock, PlayCircle, BookOpen, Loader2, GraduationCap,
  BarChart3,
} from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';
import { CountdownTimer } from '@/components/CountdownTimer';

type Props = {
  onStartSimulation: (simulationId: string) => void;
  onViewResults: (simulationId: string, attemptId?: string) => void;
  onOpenPractice: () => void;
};

type SimWithStatus = Simulation & {
  attempts: Attempt[];
  hasSubmitted: boolean;
  hasInProgress: boolean;
  questionCount: number;
};

type TabId = 'all' | 'practice' | 'premium' | 'dashboard';

export default function StudentDashboard({ onStartSimulation, onViewResults, onOpenPractice }: Props) {
  const { profile, signOut } = useAuth();
  const [simulations, setSimulations] = useState<SimWithStatus[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subPrice, setSubPrice] = useState(30);
  const [buyingSub, setBuyingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subSuccess, setSubSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('all');

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

    const simIds = (sims || []).map((s) => s.id);
    const questionCounts: Record<string, number> = {};
    if (simIds.length > 0) {
      const results = await Promise.all(
        simIds.map((sid) => supabase.rpc('get_exam_question_count', { p_simulation_id: sid }))
      );
      results.forEach((res) => {
        if (res.data && res.data.length > 0) {
          const row = res.data[0] as { sim_id: string; question_count: number };
          questionCounts[row.sim_id] = Number(row.question_count);
        }
      });
    }

    const enriched: SimWithStatus[] = (sims || []).map((sim) => {
      const simAttempts = (atts || []).filter((a) => a.simulation_id === sim.id) || [];
      const hasSubmitted = simAttempts.some((a) => a.submitted_at);
      const hasInProgress = simAttempts.some((a) => !a.submitted_at);
      return {
        ...(sim as Simulation),
        attempts: simAttempts,
        hasSubmitted,
        hasInProgress,
        questionCount: questionCounts[sim.id] || 0,
      };
    });

    setSimulations(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleBuySubscription = async () => {
    setBuyingSub(true);
    setSubError(null);
    setSubSuccess(false);
    try {
      const { error: rpcError } = await supabase.rpc('activate_test_subscription');
      if (rpcError) {
        console.error('Subscription activation error:', rpcError);
        setSubError('Nu s-a putut activa abonamentul. Încearcă din nou.');
      } else {
        setSubSuccess(true);
        setTimeout(() => setSubSuccess(false), 4000);
        await loadDashboard();
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setSubError('A apărut o eroare neașteptată.');
    } finally {
      setBuyingSub(false);
    }
  };

  if (loading) return <Loading message="Se încarcă simulările..." />;

  const hasActiveSub = !!subscription;
  const completedDistinctCount = simulations.filter((s) => s.hasSubmitted).length;

  // Filter simulations by active tab
  const filteredSims = simulations.filter((sim) => {
    if (activeTab === 'premium') return sim.requires_subscription;
    return true;
  });

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Toate simulările', icon: <Archive size={15} /> },
    { id: 'practice', label: 'Grile pe lecții', icon: <GraduationCap size={15} /> },
    { id: 'premium', label: 'Examene și simulări UMFCD', icon: <Crown size={15} /> },
    { id: 'dashboard', label: 'Dashboard activitate', icon: <BarChart3 size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center gap-2">
            <Logo className="h-9 w-auto flex-shrink-0" />
            <div className="flex flex-col text-[12px] font-extrabold uppercase tracking-wide leading-[1.08] select-none whitespace-nowrap">
              <span className="text-stone-900">Biletul</span>
              <span className="text-stone-900">Spre</span>
              <span className="text-brand-600 font-black">Medicină</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm font-medium text-stone-600 sm:inline max-w-[200px] truncate">
              {profile?.full_name || profile?.email}
            </span>
            <button onClick={signOut} className="btn-ghost text-sm">
              Deconectare
            </button>
          </div>
        </div>
      </header>

      {/* ── Main container ── */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="rounded-3xl border border-stone-200/80 bg-white/60 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 lg:p-8">

            {/* ── Countdown timer ── */}
            <div className="mb-6 rounded-2xl border border-stone-700 bg-stone-900 p-5 sm:p-6 overflow-hidden">
              <p className="mb-4 text-center font-display text-sm font-bold tracking-wide text-white sm:text-base">
                Materiale noi pe platformă în:
              </p>
              <CountdownTimer />
              <p className="mx-auto mt-4 max-w-xl text-center text-xs text-stone-400">
                Alătură-te comunității de viitori medici și fii primul care accesează noile simulări și grile explicate.
              </p>
            </div>

            {/* ── Subscription bar ── */}
            {hasActiveSub ? (
              <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">Abonamentul tău este activ</p>
                    <p className="text-sm text-stone-600">
                      Valabil până la{' '}
                      <span className="font-medium text-stone-800">
                        {new Date(subscription!.end_at).toLocaleDateString('ro-RO', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-white">
                    <Crown size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">Nu ai un abonament activ</p>
                    <p className="text-sm text-stone-600">
                      Abonament lunar — {subPrice} RON/lună · Acces la toate simulările premium timp de 30 de zile.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 sm:items-end">
                  <button
                    onClick={handleBuySubscription}
                    disabled={buyingSub}
                    className="btn-accent whitespace-nowrap w-full sm:w-auto"
                  >
                    {buyingSub && <Loader2 size={16} className="animate-spin" />}
                    <Crown size={16} /> Cumpără abonament
                  </button>
                  <span className="text-xs text-stone-400">Mod test – se activează gratuit</span>
                </div>
              </div>
            )}

            {subError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {subError}
              </div>
            )}
            {subSuccess && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
                Abonamentul a fost activat cu succes! Ai acces la toate simulările premium timp de 30 de zile.
              </div>
            )}

            {/* ── Tab navigation ── */}
            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold
                      transition-all duration-200 whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'border-brand-300 bg-brand-100 text-brand-800 shadow-sm'
                        : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700'
                      }
                    `}
                    aria-pressed={activeTab === tab.id}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Progress indicator ── */}
            {activeTab !== 'dashboard' && activeTab !== 'practice' && (
              <div className="mb-6">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <p className="font-display text-lg font-bold text-stone-900">
                    <span className="text-brand-600">{completedDistinctCount}</span>
                    <span className="text-stone-400"> / {filteredSims.length}</span>
                    <span className="text-stone-700"> simulări rezolvate</span>
                  </p>
                  <span className="text-sm text-stone-400 hidden sm:inline">
                    {filteredSims.length} simulări în această categorie
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
                    style={{
                      width: `${filteredSims.length > 0 ? Math.min(100, (completedDistinctCount / filteredSims.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Practice tab ── */}
            {activeTab === 'practice' && (
              <div>
                <div className="mb-6 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-accent-200 bg-accent-50 p-5 transition-all hover:border-accent-300 hover:bg-accent-100"
                  onClick={onOpenPractice}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPractice(); } }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white">
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-stone-900">Grile pe lecții</h3>
                      <p className="text-sm text-stone-600">
                        Antrenează-te pe seturi de grile organizate pe lecții. Fără cronometru, rezolvări nelimitate.
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-accent-600">
                    <BookOpen size={24} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Dashboard tab ── */}
            {activeTab === 'dashboard' && (
              <div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    icon={<Archive size={20} />}
                    label="Simulări disponibile"
                    value={simulations.length}
                    color="brand"
                  />
                  <StatCard
                    icon={<Trophy size={20} />}
                    label="Simulări rezolvate"
                    value={completedDistinctCount}
                    color="accent"
                  />
                  <StatCard
                    icon={<Sparkles size={20} />}
                    label="Simulări gratuite"
                    value={simulations.filter((s) => !s.requires_subscription).length}
                    color="brand"
                  />
                  <StatCard
                    icon={<CreditCard size={20} />}
                    label="Status abonament"
                    value={hasActiveSub ? 'Activ' : 'Inactiv'}
                    color={hasActiveSub ? 'accent' : 'brand'}
                  />
                </div>
              </div>
            )}

            {/* ── Simulation grid ── */}
            {(activeTab === 'all' || activeTab === 'premium') && (
              <>
                {filteredSims.length === 0 ? (
                  <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-stone-500">
                    <Archive size={40} className="mx-auto mb-4 text-stone-300" />
                    <p className="text-lg font-medium">Nu există simulări în această categorie.</p>
                    <p className="text-sm mt-1">Revino mai târziu pentru simulări noi.</p>
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredSims.map((sim) => (
                      <ArchiveSimCard
                        key={sim.id}
                        sim={sim}
                        hasActiveSub={hasActiveSub}
                        onStart={() => onStartSimulation(sim.id)}
                        onViewResults={(attemptId) => onViewResults(sim.id, attemptId)}
                        onBuySubscription={handleBuySubscription}
                        buyingSub={buyingSub}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: 'brand' | 'accent' }) {
  const bg = color === 'brand' ? 'bg-brand-100 text-brand-600' : 'bg-accent-100 text-accent-600';
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-sm text-stone-500">{label}</p>
    </div>
  );
}

// ── ArchiveSimCard ────────────────────────────────────────────────────────

function ArchiveSimCard({
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
  onViewResults: (attemptId?: string) => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
}) {
  const isFree = !sim.requires_subscription;
  const submittedAttempts = sim.attempts.filter((a) => a.submitted_at);
  const hasSubmitted = submittedAttempts.length > 0;
  const hasInProgress = sim.attempts.some((a) => !a.submitted_at);
  const latestAttempt = submittedAttempts[0];

  return (
    <div className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-stone-300 hover:shadow-md motion-reduce:transition-none">
      {/* Title + status badge */}
      <div className="mb-3 flex items-start gap-2 flex-wrap">
        <h3 className="font-display text-base font-semibold leading-snug text-stone-900 line-clamp-2 flex-1 min-w-0">
          {sim.title}
        </h3>
        {isFree ? (
          hasSubmitted ? (
            <span className="badge shrink-0 bg-brand-100 text-brand-700">
              <CheckCircle2 size={12} /> Susținut ({submittedAttempts.length}x)
            </span>
          ) : (
            <span className="badge shrink-0 bg-stone-100 text-stone-500">Nesusținut</span>
          )
        ) : hasSubmitted ? (
          <span className="badge shrink-0 bg-stone-200 text-stone-600">
            <CheckCircle2 size={12} /> Susținut
          </span>
        ) : hasActiveSub ? (
          <span className="badge shrink-0 bg-amber-100 text-amber-700">
            <Crown size={12} /> Abonament activ
          </span>
        ) : (
          <span className="badge shrink-0 bg-stone-100 text-stone-500">
            <Lock size={12} /> Abonament necesar
          </span>
        )}
      </div>

      {/* Description */}
      {sim.description && (
        <p className="mb-3 text-sm text-stone-600 line-clamp-2">{sim.description}</p>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 mb-4">
        <span className="flex items-center gap-1">
          <Clock size={13} />
          {sim.duration_minutes} min
        </span>
        <span className="flex items-center gap-1">
          <BookOpen size={13} />
          {sim.questionCount} grile
        </span>
        <span className="flex items-center gap-1">
          {isFree ? <Sparkles size={13} /> : <Crown size={13} />}
          {isFree ? 'Gratuită' : 'Necesită abonament'}
        </span>
        {hasInProgress && (
          <span className="flex items-center gap-1 font-medium text-amber-600">
            <Clock size={13} /> Încercare în curs
          </span>
        )}
      </div>

      {/* Actions area — pinned to bottom */}
      <div className="mt-auto flex flex-col gap-2 border-t border-stone-100 pt-4">
        {/* FREE sims: always show "Rezolvă" + "Detalii" after first attempt */}
        {isFree && (
          <>
            <button onClick={onStart} className="btn-primary w-full">
              {hasInProgress ? (
                <><PlayCircle size={16} /> Continuă simularea</>
              ) : hasSubmitted ? (
                <><RotateCcw size={16} /> Rezolvă din nou</>
              ) : (
                <><PlayCircle size={16} /> Rezolvă simularea</>
              )}
            </button>
            {hasSubmitted ? (
              <button onClick={() => onViewResults(latestAttempt?.id)} className="btn-secondary w-full">
                <BookOpen size={16} /> Detalii simulare
              </button>
            ) : (
              <span className="text-xs text-stone-400 flex items-center justify-center gap-1">
                <Lock size={11} /> Detaliile sunt disponibile după prima rezolvare
              </span>
            )}
            <span className="text-xs text-stone-400 flex items-center justify-center gap-1">
              <Sparkles size={11} /> Antrenament nelimitat
            </span>
          </>
        )}

        {/* PREMIUM + has submitted: only "Detalii" full width */}
        {!isFree && hasSubmitted && (
          <>
            <button onClick={() => onViewResults(latestAttempt?.id)} className="btn-secondary w-full">
              <BookOpen size={16} /> Detalii simulare
            </button>
            <span className="text-xs text-stone-500 font-medium text-center">
              Susținut — o singură încercare
            </span>
          </>
        )}

        {/* PREMIUM + sub + no attempt: "Rezolvă simularea" full width */}
        {!isFree && hasActiveSub && !hasSubmitted && (
          <button onClick={onStart} className="btn-primary w-full">
            {hasInProgress ? (
              <><PlayCircle size={16} /> Continuă simularea</>
            ) : (
              <><PlayCircle size={16} /> Rezolvă simularea</>
            )}
          </button>
        )}

        {/* PREMIUM + no sub: "Cumpără abonament" full width */}
        {!isFree && !hasActiveSub && !hasSubmitted && (
          <>
            <button
              onClick={onBuySubscription}
              disabled={buyingSub}
              className="btn-accent w-full"
            >
              {buyingSub && <Loader2 size={16} className="animate-spin" />}
              <Crown size={16} /> Cumpără abonament pentru a accesa
            </button>
            <span className="text-xs text-stone-400 text-center">Mod test – abonamentul se activează gratuit</span>
          </>
        )}
      </div>
    </div>
  );
}
