import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Simulation, type Question, type Attempt } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Clock, Send, AlertTriangle, Loader2, ChevronLeft } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  simulationId: string;
  onExit: () => void;
  onComplete: () => void;
  isArchiveRetake?: boolean;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export default function SimulationView({ simulationId, onExit, onComplete, isArchiveRetake = false }: Props) {
  const { profile } = useAuth();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  // Load simulation + questions
  useEffect(() => {
    (async () => {
      const { data: sim } = await supabase
        .from('simulations')
        .select('*')
        .eq('id', simulationId)
        .maybeSingle();
      if (!sim) {
        setLoading(false);
        return;
      }
      setSimulation(sim as Simulation);

      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .eq('simulation_id', simulationId)
        .order('position', { ascending: true });
      setQuestions((qs || []) as Question[]);
      setLoading(false);
    })();
  }, [simulationId]);

  // Check for existing attempt
  useEffect(() => {
    if (!profile) return;
    (async () => {
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
      if (att) {
        setAttempt(att as Attempt);
        if ((att as Attempt).submitted_at) {
          onComplete();
          return;
        }
        setAnswers((att as Attempt).answers || {});
        setStarted(true);
      }
    })();
  }, [profile, simulationId, onComplete, isArchiveRetake]);

  const submitAttempt = useCallback(
    async (expired: boolean) => {
      if (submittedRef.current || !profile || !simulation) return;
      submittedRef.current = true;
      setSubmitting(true);

      const score = questions.reduce((acc, q) => {
        return acc + (answers[q.id] === q.correct_answer ? 1 : 0);
      }, 0);
      const maxScore = questions.length;

      if (attempt) {
        const { error } = await supabase
          .from('attempts')
          .update({
            answers,
            score,
            max_score: maxScore,
            submitted_at: new Date().toISOString(),
            expired,
          })
          .eq('id', attempt.id);
        if (error) {
          console.error('Submit error:', error);
          submittedRef.current = false;
          setSubmitting(false);
        }
      } else {
        const { error } = await supabase.from('attempts').insert({
          user_id: profile.id,
          simulation_id: simulationId,
          answers,
          score,
          max_score: maxScore,
          submitted_at: new Date().toISOString(),
          expired,
          is_archive_retake: isArchiveRetake,
        });
        if (error) {
          console.error('Submit error:', error);
          submittedRef.current = false;
          setSubmitting(false);
        }
      }

      setSubmitting(false);
      onComplete();
    },
    [profile, simulation, questions, answers, attempt, simulationId, onComplete]
  );

  // Timer
  useEffect(() => {
    if (!started || !simulation) return;

    const startTime = attempt?.started_at ? new Date(attempt.started_at).getTime() : Date.now();
    const endTime = startTime + simulation.duration_minutes * 60 * 1000;

    if (!attempt) {
      // Create attempt record on start
      (async () => {
        if (!profile) return;
        const { data: att } = await supabase
          .from('attempts')
          .insert({
            user_id: profile.id,
            simulation_id: simulationId,
            answers: {},
            score: 0,
            max_score: 0,
            started_at: new Date(startTime).toISOString(),
            is_archive_retake: isArchiveRetake,
          })
          .select('*')
          .maybeSingle();
        if (att) setAttempt(att as Attempt);
      })();
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        submitAttempt(true);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, simulation]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setStarted(true);
  };

  const handleAnswer = (questionId: string, letter: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: letter }));
  };

  if (loading) return <Loading message="Se încarcă simularea..." />;

  if (!simulation) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        <p>Simularea nu a fost găsită.</p>
      </div>
    );
  }

  // Pre-start screen
  if (!started) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Logo size="sm" />
            <button onClick={onExit} className="btn-ghost">
              <ChevronLeft size={16} /> Ieși
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
              <Clock size={32} />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-stone-900 mb-3">{simulation.title}</h1>
          <p className="text-stone-600 mb-8">{simulation.description}</p>

          <div className="card p-6 mb-8 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Timp alocat" value={`${simulation.duration_minutes} minute`} />
              <InfoRow label="Număr de grile" value={`${questions.length}`} />
              <InfoRow label="Fereastră acces" value={`${new Date(simulation.start_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })} — ${new Date(simulation.end_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}`} />
              <InfoRow label="Punctaj" value="Totul sau nimic (1 punct / grilă)" />
            </div>
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex gap-3">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Atenție:</strong> Cronometrul pornește la apăsarea butonului „Start" și nu poate fi oprit.
                La expirarea timpului, răspunsurile se trimit automat. Rezultatele și explicațiile se deblochează
                după închiderea ferestrei de acces.
              </div>
            </div>
          </div>

          <button onClick={handleStart} className="btn-primary text-base">
            Start Simulare
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Sticky header with timer */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="text-sm font-medium text-stone-700 hidden sm:inline">{simulation.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono font-bold text-sm ${timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-700'}`}>
              <Clock size={16} />
              {formatTime(timeLeft)}
            </div>
            <button
              onClick={() => submitAttempt(false)}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              <Send size={16} />
              Trimite
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Progress */}
        <div className="mb-6 flex items-center justify-between text-sm text-stone-500">
          <span>{answeredCount} / {questions.length} întrebări răspunse</span>
          <div className="h-2 flex-1 mx-4 rounded-full bg-stone-200 overflow-hidden max-w-xs">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              selectedAnswer={answers[q.id]}
              onSelect={(letter) => handleAnswer(q.id, letter)}
            />
          ))}
        </div>

        {questions.length === 0 && (
          <div className="card p-12 text-center text-stone-500">
            <p>Nu există întrebări în această simulare.</p>
          </div>
        )}

        {/* Submit button at bottom */}
        {questions.length > 0 && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => submitAttempt(false)}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              <Send size={16} />
              Trimite răspunsurile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  selectedAnswer,
  onSelect,
}: {
  question: Question;
  index: number;
  selectedAnswer: string | undefined;
  onSelect: (letter: string) => void;
}) {
  const isCG = question.type === 'CG';

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-xs font-bold text-stone-600">
          {index + 1}
        </span>
        <div className="flex-1">
          <span className="badge bg-stone-100 text-stone-600 mb-2">
            {isCG ? 'Complement Grupat' : 'Complement Simplu'}
          </span>
          <p className="text-stone-900 font-medium leading-relaxed">{question.question_text}</p>
        </div>
      </div>

      {/* CG statements */}
      {isCG && (
        <div className="mb-4 ml-10 space-y-2">
          {[1, 2, 3, 4].map((n) => {
            const text = question[`statement_${n}` as keyof Question] as string;
            if (!text) return null;
            return (
              <div key={n} className="flex gap-2 text-sm text-stone-700">
                <span className="font-semibold text-stone-500">{n}.</span>
                <span>{text}</span>
              </div>
            );
          })}
          <div className="mt-3 rounded-lg bg-stone-50 border border-stone-200 p-3 text-xs text-stone-500">
            <strong>Variante:</strong> A = 1, 2, 3 · B = 1, 3 · C = 2, 4 · D = doar 4 · E = toate sau altă combinație
          </div>
        </div>
      )}

      {/* Options */}
      <div className="ml-10 grid gap-2">
        {LETTERS.map((letter) => {
          const optionText = isCG
            ? getCGLabel(letter)
            : (question[`option_${letter.toLowerCase()}` as keyof Question] as string);

          if (!optionText && !isCG) return null;

          const isSelected = selectedAnswer === letter;

          return (
            <button
              key={letter}
              onClick={() => onSelect(letter)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                isSelected
                  ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/20'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isSelected ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'
              }`}>
                {letter}
              </span>
              <span>{optionText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getCGLabel(letter: string): string {
  const labels: Record<string, string> = {
    A: 'Afirmațiile 1, 2, 3 sunt corecte',
    B: 'Afirmațiile 1, 3 sunt corecte',
    C: 'Afirmațiile 2, 4 sunt corecte',
    D: 'Doar afirmația 4 este corectă',
    E: 'Toate cele 4 corecte sau altă combinație',
  };
  return labels[letter] || '';
}
