import { useEffect, useState } from 'react';
import { supabase, type Simulation, type Attempt, type AttemptResult, type Subscription } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Lock, Trophy, CheckCircle2, XCircle, ChevronLeft, Clock, Crown, RotateCcw, History } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  simulationId: string;
  attemptId?: string;
  onExit: () => void;
  onRetake?: (simulationId: string) => void;
};

export default function ResultsView({ simulationId, attemptId, onExit, onRetake }: Props) {
  const { profile } = useAuth();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(attemptId || null);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sim } = await supabase
        .from('simulations')
        .select('*')
        .eq('id', simulationId)
        .maybeSingle();
      setSimulation(sim as Simulation | null);

      if (profile) {
        const { data: atts } = await supabase
          .from('attempts')
          .select('*')
          .eq('user_id', profile.id)
          .eq('simulation_id', simulationId)
          .order('started_at', { ascending: false });
        setAttempts((atts || []) as Attempt[]);

        const completed = (atts || []).filter((a) => a.submitted_at);
        if (attemptId) {
          setSelectedAttemptId(attemptId);
        } else if (completed.length > 0) {
          setSelectedAttemptId(completed[0].id);
        }

        const { data: subs } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', profile.id)
          .order('end_at', { ascending: false });
        const now = new Date();
        const activeSub = (subs || []).find(
          (s) => s.status === 'active' && new Date(s.end_at) > now
        ) as Subscription | undefined;
        setSubscription(activeSub || null);
      }

      setLoading(false);
    })();
  }, [simulationId, profile, attemptId]);

  const isFree = simulation ? !simulation.requires_subscription : false;
  const hasActiveSub = !!subscription;
  const canViewDetails = isFree || hasActiveSub || attempts.some((a) => a.id === selectedAttemptId && a.submitted_at);

  useEffect(() => {
    if (!selectedAttemptId) return;
    setResultsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .rpc('get_attempt_results', { p_attempt_id: selectedAttemptId });

      if (error) {
        setResultsLoading(false);
        return;
      }
      setResults((data || []) as unknown as AttemptResult[]);
      setResultsLoading(false);
    })();
  }, [selectedAttemptId]);

  if (loading) return <Loading message="Se încarcă rezultatele..." />;

  if (!simulation) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        <p>Simularea nu a fost găsită.</p>
      </div>
    );
  }

  const completedAttempts = attempts.filter((a) => a.submitted_at);
  const currentAttempt = attempts.find((a) => a.id === selectedAttemptId);
  const score = currentAttempt?.score ?? 0;
  const maxScore = currentAttempt?.max_score ?? 0;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo size="sm" />
          <button onClick={onExit} className="btn-ghost">
            <ChevronLeft size={16} /> Înapoi la arhivă
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-stone-900 mb-1">{simulation.title}</h1>
        <p className="text-stone-500 text-sm mb-6">Rezultate și explicații</p>

        {!canViewDetails && (
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Lock size={32} />
            </div>
            <h2 className="font-display text-lg font-semibold text-stone-900 mb-2">
              Disponibil doar cu abonament
            </h2>
            <p className="text-sm text-stone-600 max-w-md mx-auto mb-4">
              Pentru a vedea răspunsurile tale, punctajul și explicațiile detaliate,
              ai nevoie de un abonament activ.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
              <Crown size={16} />
              Activează un abonament pentru acces complet
            </div>
            <div className="mt-6">
              <button onClick={onExit} className="btn-secondary">
                <ChevronLeft size={16} /> Înapoi la arhivă
              </button>
            </div>
          </div>
        )}

        {canViewDetails && (
          <>
            {/* Attempt selector for free sims */}
            {isFree && completedAttempts.length > 1 && (
              <div className="card p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <History size={18} className="text-stone-500" />
                  <h3 className="text-sm font-semibold text-stone-700">Istoric încercări</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {completedAttempts.map((att, idx) => {
                    const pct = att.max_score > 0 ? Math.round((att.score / att.max_score) * 100) : 0;
                    const isSelected = att.id === selectedAttemptId;
                    return (
                      <button
                        key={att.id}
                        onClick={() => setSelectedAttemptId(att.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50 text-brand-900'
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <span className="font-medium">Încercarea {completedAttempts.length - idx}</span>
                        <span className="text-xs text-stone-500">
                          {new Date(att.started_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className={`text-xs font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                          {att.score}/{att.max_score} ({pct}%)
                        </span>
                        {att.expired && (
                          <span className="badge bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5">
                            <Clock size={10} /> Timp
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Score summary */}
            <div className="card p-8 mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                <Trophy size={32} />
              </div>
              {currentAttempt ? (
                <>
                  <p className="text-sm text-stone-500 mb-1">Scorul obținut</p>
                  <p className="font-display text-4xl font-extrabold text-stone-900 mb-2">
                    {score} <span className="text-2xl text-stone-400">/ {maxScore}</span>
                  </p>
                  <p className="text-lg font-semibold text-brand-600">{percentage}%</p>
                  {currentAttempt.expired && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-700">
                      <Clock size={14} />
                      Timpul a expirat — răspunsurile au fost trimise automat
                    </p>
                  )}
                  <p className="mt-2 text-xs text-stone-400">
                    {new Date(currentAttempt.started_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </>
              ) : (
                <p className="text-stone-500">Nu ai susținut această simulare.</p>
              )}
            </div>

            {/* Retake button for free sims */}
            {isFree && onRetake && (
              <div className="mb-6 flex justify-center">
                <button onClick={() => onRetake(simulationId)} className="btn-primary">
                  <RotateCcw size={16} /> Rezolvă din nou
                </button>
              </div>
            )}

            {/* Detailed answers with explanations */}
            {currentAttempt && results.length > 0 && !resultsLoading && (
              <div>
                <h2 className="mb-4 font-display text-lg font-semibold text-stone-900">
                  Răspunsuri și explicații
                </h2>
                <div className="space-y-4">
                  {results.map((r, idx) => {
                    const userAnswer = currentAttempt.answers[r.question_id];
                    const isCorrect = userAnswer === r.correct_answer;
                    const isCG = r.q_type === 'CG';

                    return (
                      <div key={r.question_id} className="card p-6">
                        <div className="mb-3 flex items-start gap-3">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="badge bg-stone-100 text-stone-600">
                                {isCG ? 'Complement Grupat' : 'Complement Simplu'}
                              </span>
                              {isCorrect ? (
                                <span className="badge bg-green-100 text-green-700">
                                  <CheckCircle2 size={12} /> Corect · 1 punct
                                </span>
                              ) : (
                                <span className="badge bg-red-100 text-red-700">
                                  <XCircle size={12} /> Greșit · 0 puncte
                                </span>
                              )}
                            </div>
                            <p className="text-stone-900 font-medium leading-relaxed mb-3">{r.question_text}</p>
                          </div>
                        </div>

                        {isCG && (
                          <div className="mb-4 ml-10 space-y-1.5">
                            {[1, 2, 3, 4].map((n) => {
                              const text = r[`statement_${n}` as keyof AttemptResult] as string;
                              if (!text) return null;
                              return (
                                <div key={n} className="flex gap-2 text-sm text-stone-700">
                                  <span className="font-semibold text-stone-500">{n}.</span>
                                  <span>{text}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!isCG && (
                          <div className="mb-4 ml-10 grid gap-2">
                            {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
                              const text = r[`option_${letter.toLowerCase()}` as keyof AttemptResult] as string;
                              if (!text) return null;
                              const isCorrectOption = r.correct_answer === letter;
                              const isUserChoice = userAnswer === letter;

                              return (
                                <div
                                  key={letter}
                                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                                    isCorrectOption
                                      ? 'border-green-300 bg-green-50 text-green-900'
                                      : isUserChoice
                                      ? 'border-red-300 bg-red-50 text-red-900'
                                      : 'border-stone-200 bg-white text-stone-700'
                                  }`}
                                >
                                  <span
                                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                      isCorrectOption
                                        ? 'bg-green-600 text-white'
                                        : isUserChoice
                                        ? 'bg-red-500 text-white'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}
                                  >
                                    {letter}
                                  </span>
                                  <span className="flex-1">{text}</span>
                                  {isCorrectOption && (
                                    <span className="badge bg-green-100 text-green-700">
                                      <CheckCircle2 size={12} /> Corect
                                    </span>
                                  )}
                                  {isUserChoice && !isCorrectOption && (
                                    <span className="badge bg-red-100 text-red-700">
                                      <XCircle size={12} /> Răspunsul tău
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {isCG && (
                          <div className="ml-10 grid gap-2 mb-4">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-stone-500 w-32 flex-shrink-0">Răspunsul tău:</span>
                              <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                {userAnswer || 'Nerăspuns'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-stone-500 w-32 flex-shrink-0">Răspuns corect:</span>
                              <span className="font-bold text-green-700">{r.correct_answer}</span>
                            </div>
                          </div>
                        )}

                        {r.explanation && (
                          <div className="ml-10 rounded-xl bg-brand-50 border border-brand-100 p-4">
                            <p className="text-xs font-semibold text-brand-700 mb-1">Explicație</p>
                            <p className="text-sm text-stone-700 leading-relaxed">{r.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {resultsLoading && (
              <div className="flex justify-center py-8">
                <Loading message="Se încarcă răspunsurile..." />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
