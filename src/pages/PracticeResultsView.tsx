import { useEffect, useState } from 'react';
import { supabase, type PracticeResultRPC, type PracticeHistoryRPC, type Subscription } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronLeft, Trophy, CheckCircle2, XCircle, RotateCcw, BookOpen, History, Crown,
} from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  setId: string;
  attemptId?: string;
  onExit: () => void;
  onRetake: () => void;
};

export default function PracticeResultsView({ setId, attemptId, onExit, onRetake }: Props) {
  const { profile, signOut } = useAuth();
  const [results, setResults] = useState<PracticeResultRPC[]>([]);
  const [history, setHistory] = useState<PracticeHistoryRPC[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(attemptId || null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    (async () => {
      // Load history
      const { data: hist } = await supabase.rpc('get_practice_history', { p_set_id: setId });
      const histData = (hist || []) as unknown as PracticeHistoryRPC[];
      setHistory(histData);

      if (attemptId) {
        setSelectedAttemptId(attemptId);
      } else if (histData.length > 0) {
        setSelectedAttemptId(histData[0].out_id);
      }

      // Load subscription
      if (profile) {
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
  }, [setId, profile, attemptId]);

  useEffect(() => {
    if (!selectedAttemptId) return;
    setResultsLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc('get_practice_results', {
        p_attempt_id: selectedAttemptId,
      });
      if (error) {
        setResultsLoading(false);
        return;
      }
      setResults((data || []) as unknown as PracticeResultRPC[]);
      setResultsLoading(false);
    })();
  }, [selectedAttemptId]);

  if (loading) return <Loading message="Se încarcă rezultatele..." />;

  const score = results.length > 0 ? results[0].out_score : 0;
  const maxScore = results.length > 0 ? results[0].out_max_score : 0;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const hasActiveSub = !!subscription;
  const currentAttempt = history.find((h) => h.out_id === selectedAttemptId);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <Logo size="sm" />
          <button onClick={onExit} className="btn-ghost">
            <ChevronLeft size={16} /> Înapoi la seturi
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-display text-2xl font-bold text-stone-900 mb-1">Rezultate set de grile</h1>
        <p className="text-stone-500 text-sm mb-6">Scor, răspunsuri corecte și explicații</p>

        {/* History selector */}
        {history.length > 1 && (
          <div className="card p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <History size={18} className="text-stone-500" />
              <h3 className="text-sm font-semibold text-stone-700">Istoric încercări ({history.length})</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((att, idx) => {
                const pct = att.out_max_score > 0 ? Math.round((att.out_score / att.out_max_score) * 100) : 0;
                const isSelected = att.out_id === selectedAttemptId;
                return (
                  <button
                    key={att.out_id}
                    onClick={() => setSelectedAttemptId(att.out_id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 text-brand-900'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span className="font-medium">Încercarea {history.length - idx}</span>
                    <span className="text-xs text-stone-500">
                      {new Date(att.out_started_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`text-xs font-bold ${pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                      {att.out_score}/{att.out_max_score} ({pct}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Score summary */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <div className="card p-8 text-center md:col-span-1">
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
                <p className="mt-2 text-xs text-stone-400">
                  {new Date(currentAttempt.out_started_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </>
            ) : (
              <p className="text-stone-500">Nu ai rezolvat acest set încă.</p>
            )}
          </div>

          <div className="md:col-span-2 space-y-6">
            {/* Retake */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={onRetake} className="btn-primary">
                <RotateCcw size={16} /> Rezolvă din nou
              </button>
              <button onClick={onExit} className="btn-secondary">
                <BookOpen size={16} /> Înapoi la seturi
              </button>
            </div>

            {/* Detailed answers */}
            {results.length > 0 && !resultsLoading && (
              <div>
                <h2 className="mb-4 font-display text-lg font-semibold text-stone-900">
                  Răspunsuri și explicații
                </h2>
                <div className="space-y-4">
                  {results.map((r, idx) => {
                    const userAnswer = results[0].out_answers[r.out_question_id];
                    const isCorrect = userAnswer === r.out_correct_answer;
                    const isCG = r.out_q_type === 'CG';

                    return (
                      <div key={r.out_question_id} className="card p-6">
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
                                  <CheckCircle2 size={12} /> Corect
                                </span>
                              ) : (
                                <span className="badge bg-red-100 text-red-700">
                                  <XCircle size={12} /> Greșit
                                </span>
                              )}
                            </div>
                            <p className="text-stone-900 font-medium leading-relaxed mb-3">{r.out_question_text}</p>
                          </div>
                        </div>

                        {isCG && (
                          <div className="mb-4 ml-10 space-y-1.5">
                            {[1, 2, 3, 4].map((n) => {
                              const text = r[`out_statement_${n}` as keyof PracticeResultRPC] as string;
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
                              const text = r[`out_option_${letter.toLowerCase()}` as keyof PracticeResultRPC] as string;
                              if (!text) return null;
                              const isCorrectOption = r.out_correct_answer === letter;
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
                                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                    isCorrectOption
                                      ? 'bg-green-600 text-white'
                                      : isUserChoice
                                      ? 'bg-red-500 text-white'
                                      : 'bg-stone-100 text-stone-600'
                                  }`}>
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
                              <span className="font-bold text-green-700">{r.out_correct_answer}</span>
                            </div>
                          </div>
                        )}

                        {r.out_explanation && (
                          <div className="ml-10 rounded-xl bg-brand-50 border border-brand-100 p-4">
                            <p className="text-xs font-semibold text-brand-700 mb-1">Explicație</p>
                            <p className="text-sm text-stone-700 leading-relaxed">{r.out_explanation}</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
