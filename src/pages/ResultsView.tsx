import { useEffect, useState } from 'react';
import { supabase, type Simulation, type Question, type Attempt, type Subscription } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Lock, Trophy, CheckCircle2, XCircle, ChevronLeft, Clock, PartyPopper, Crown } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  simulationId: string;
  onExit: () => void;
  isArchiveRetake?: boolean;
};

export default function ResultsView({ simulationId, onExit, isArchiveRetake = false }: Props) {
  const { profile } = useAuth();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sim } = await supabase
        .from('simulations')
        .select('*')
        .eq('id', simulationId)
        .maybeSingle();
      setSimulation(sim as Simulation | null);

      if (profile) {
        let query = supabase
          .from('attempts')
          .select('*')
          .eq('user_id', profile.id)
          .eq('simulation_id', simulationId);
        if (isArchiveRetake) {
          query = query.eq('is_archive_retake', true);
        } else {
          query = query.eq('is_archive_retake', false);
        }
        const { data: att } = await query.maybeSingle();
        setAttempt(att as Attempt | null);

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
  }, [simulationId, profile, isArchiveRetake]);

  const isUnlocked = isArchiveRetake || (simulation ? new Date() > new Date(simulation.end_at) : false);
  const isFree = simulation ? !simulation.requires_subscription : false;
  const hasActiveSub = !!subscription;
  const canViewDetails = isFree || hasActiveSub;

  useEffect(() => {
    if (!isUnlocked) return;
    (async () => {
      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .eq('simulation_id', simulationId)
        .order('position', { ascending: true });
      setQuestions((qs || []) as Question[]);
    })();
  }, [simulationId, isUnlocked]);

  if (loading) return <Loading message="Se încarcă rezultatele..." />;

  if (!simulation) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        <p>Simularea nu a fost găsită.</p>
      </div>
    );
  }

  const endDate = new Date(simulation.end_at);
  const score = attempt?.score ?? 0;
  const maxScore = attempt?.max_score ?? 0;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo size="sm" />
          <button onClick={onExit} className="btn-ghost">
            <ChevronLeft size={16} /> Înapoi la dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-stone-900 mb-1">{simulation.title}</h1>
        <p className="text-stone-500 text-sm mb-6">Rezultate și explicații</p>

        {/* Locked state — waiting for window to close */}
        {!isUnlocked && (
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
              <PartyPopper size={32} />
            </div>
            <h2 className="font-display text-lg font-semibold text-stone-900 mb-2">
              Felicitări!
            </h2>
            <p className="text-sm text-stone-600 max-w-md mx-auto mb-4">
              Ai finalizat simularea. Nota și explicațiile detaliate vor fi afișate automat
              în contul tău imediat ce se încheie intervalul de participare (după ora închiderii).
              Revino mai târziu pentru a-ți vedea rezultatul!
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-4 py-2 text-sm text-stone-600">
              <Clock size={16} />
              Deblocare la: {endDate.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="mt-6">
              <button onClick={onExit} className="btn-secondary">
                <ChevronLeft size={16} /> Înapoi la dashboard
              </button>
            </div>
          </div>
        )}

        {/* Unlocked state — full results */}
        {isUnlocked && !canViewDetails && (
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Lock size={32} />
            </div>
            <h2 className="font-display text-lg font-semibold text-stone-900 mb-2">
              Disponibil doar cu abonament
            </h2>
            <p className="text-sm text-stone-600 max-w-md mx-auto mb-4">
              Ai susținut această simulare, dar pentru a vedea răspunsurile tale,
              punctajul și explicațiile detaliate, ai nevoie de un abonament activ.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
              <Crown size={16} />
              Activează un abonament pentru acces complet
            </div>
            <div className="mt-6">
              <button onClick={onExit} className="btn-secondary">
                <ChevronLeft size={16} /> Înapoi la dashboard
              </button>
            </div>
          </div>
        )}

        {/* Unlocked state — full results */}
        {isUnlocked && canViewDetails && (
          <>
            {/* Score summary */}
            <div className="card p-8 mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
                <Trophy size={32} />
              </div>
              {attempt ? (
                <>
                  <p className="text-sm text-stone-500 mb-1">Scorul obținut</p>
                  <p className="font-display text-4xl font-extrabold text-stone-900 mb-2">
                    {score} <span className="text-2xl text-stone-400">/ {maxScore}</span>
                  </p>
                  <p className="text-lg font-semibold text-brand-600">{percentage}%</p>
                  {attempt.expired && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-700">
                      <Clock size={14} />
                      Timpul a expirat — răspunsurile au fost trimise automat
                    </p>
                  )}
                </>
              ) : (
                <p className="text-stone-500">Nu ai susținut această simulare.</p>
              )}
            </div>

            {/* Detailed answers with explanations */}
            {attempt && questions.length > 0 && (
              <div>
                <h2 className="mb-4 font-display text-lg font-semibold text-stone-900">
                  Răspunsuri și explicații
                </h2>
                <div className="space-y-4">
                  {questions.map((q, idx) => {
                    const userAnswer = attempt.answers[q.id];
                    const isCorrect = userAnswer === q.correct_answer;
                    const isCG = q.type === 'CG';

                    return (
                      <div key={q.id} className="card p-6">
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
                            <p className="text-stone-900 font-medium leading-relaxed mb-3">{q.question_text}</p>
                          </div>
                        </div>

                        {/* CG statements */}
                        {isCG && (
                          <div className="mb-4 ml-10 space-y-1.5">
                            {[1, 2, 3, 4].map((n) => {
                              const text = q[`statement_${n}` as keyof Question] as string;
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

                        {/* CS options — show all A-E */}
                        {!isCG && (
                          <div className="mb-4 ml-10 grid gap-2">
                            {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
                              const text = q[`option_${letter.toLowerCase()}` as keyof Question] as string;
                              if (!text) return null;
                              const isCorrectOption = q.correct_answer === letter;
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

                        {/* CG answer comparison */}
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
                              <span className="font-bold text-green-700">{q.correct_answer}</span>
                            </div>
                          </div>
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="ml-10 rounded-xl bg-brand-50 border border-brand-100 p-4">
                            <p className="text-xs font-semibold text-brand-700 mb-1">Explicație</p>
                            <p className="text-sm text-stone-700 leading-relaxed">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
