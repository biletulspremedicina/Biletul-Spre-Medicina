import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Simulation, type ExamQuestion, type Attempt } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Clock, Send, AlertTriangle, Loader2, ChevronLeft, PlayCircle, FileText } from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  simulationId: string;
  onExit: () => void;
  onComplete: (attemptId: string) => void;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export default function SimulationView({ simulationId, onExit, onComplete }: Props) {
  const { profile } = useAuth();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

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
      setLoading(false);
    })();
  }, [simulationId]);

  const startAttempt = useCallback(async () => {
    if (!profile) return;
    setError(null);

    const { data: att, error: startError } = await supabase
      .rpc('start_exam_attempt', { p_simulation_id: simulationId });

    if (startError) {
      console.error('start_exam_attempt error:', startError);
      const msg = startError.message || '';
      if (msg.includes('Abonament necesar')) {
        setError('Ai nevoie de un abonament activ pentru a accesa această simulare.');
      } else if (msg.includes('nu este disponibil')) {
        setError('Simularea nu este disponibilă momentan.');
      } else {
        setError('Nu s-a putut porni simularea. Încearcă din nou.');
      }
      return;
    }

    if (!att || att.length === 0) {
      setError('Nu s-a putut crea încercarea.');
      return;
    }

    const newAttempt = att[0] as unknown as Attempt;
    setAttempt(newAttempt);

    if (newAttempt.submitted_at) {
      onComplete(newAttempt.id);
      return;
    }

    if (newAttempt.answers && Object.keys(newAttempt.answers).length > 0) {
      setAnswers(newAttempt.answers as Record<string, string>);
    }
    setStarted(true);
  }, [profile, simulationId, onComplete]);

  useEffect(() => {
    if (!started || !simulation || !attempt) return;

    (async () => {
      const { data: qs, error: qError } = await supabase
        .rpc('get_exam_questions', { p_simulation_id: simulationId });

      if (qError) {
        console.error('get_exam_questions error:', qError);
        setError('Nu s-au putut încărca întrebările.');
        return;
      }

      setQuestions((qs || []) as unknown as ExamQuestion[]);
    })();

    const startTime = attempt.started_at ? new Date(attempt.started_at).getTime() : Date.now();
    const endTime = startTime + simulation.duration_minutes * 60 * 1000;

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
  }, [started, simulation, attempt]);

  const submitAttempt = useCallback(
    async (expired: boolean) => {
      if (submittedRef.current || !profile || !simulation) return;
      submittedRef.current = true;
      setSubmitting(true);

      const { data, error: submitError } = await supabase
        .rpc('submit_exam_attempt', {
          p_simulation_id: simulationId,
          p_answers: answers,
          p_expired: expired,
        });

      if (submitError) {
        console.error('submit_exam_attempt error:', submitError);
        const msg = submitError.message || '';
        if (msg.includes('Abonament necesar')) {
          setError('Abonamentul nu mai este activ.');
        } else if (msg.includes('nu este disponibil')) {
          setError('Simularea nu mai este disponibilă.');
        } else {
          setError('Nu s-a putut trimite simularea. Încearcă din nou.');
        }
        submittedRef.current = false;
        setSubmitting(false);
        return;
      }

      if (data && data.length > 0) {
        const submitted = data[0] as unknown as Attempt;
        setSubmitting(false);
        onComplete(submitted.id);
      }
    },
    [profile, simulation, answers, simulationId, onComplete]
  );

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
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

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <AlertTriangle size={32} className="mx-auto mb-4 text-red-500" />
          <p className="text-stone-700 font-medium mb-2">A apărut o eroare</p>
          <p className="text-sm text-stone-500 mb-6">{error}</p>
          <button onClick={onExit} className="btn-secondary">
            <ChevronLeft size={16} /> Înapoi
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    const isPremium = simulation.requires_subscription;
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
          {simulation.description && (
            <p className="text-stone-600 mb-8">{simulation.description}</p>
          )}

          <div className="card p-6 mb-8 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Timp alocat" value={`${simulation.duration_minutes} minute`} />
              <InfoRow label="Mod de rezolvare" value="Stil de examen" />
              <InfoRow label="Tip acces" value={isPremium ? 'Necesită abonament' : 'Fără abonament'} />
              <InfoRow label="Punctaj" value="Totul sau nimic (1 punct / grilă)" />
            </div>
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex gap-3">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                {isPremium ? (
                  <>
                    <strong>Atenție:</strong> Aceasta este o simulare cu abonament și se poate susține
                    o <strong>singură dată</strong>. Cronometrul pornește la apăsarea butonului
                    „Start" și nu poate fi oprit. La expirarea timpului, răspunsurile se trimit automat.
                    Dacă închizi pagina, poți continua cu timpul rămas.
                  </>
                ) : (
                  <>
                    <strong>Atenție:</strong> Cronometrul pornește la apăsarea butonului „Start" și
                    nu poate fi oprit. La expirarea timpului, răspunsurile se trimit automat.
                    După finalizare, poți rezolva din nou de câte ori dorești.
                  </>
                )}
              </div>
            </div>
          </div>

          <button onClick={startAttempt} className="btn-primary text-base">
            <PlayCircle size={20} /> Start simulare
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-stone-50">
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
        <div className="mb-6 flex items-center justify-between text-sm text-stone-500">
          <span>{answeredCount} / {questions.length} întrebări răspunse</span>
          <div className="h-2 flex-1 mx-4 rounded-full bg-stone-200 overflow-hidden max-w-xs">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
            />
          </div>
        </div>

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
            <FileText size={40} className="mx-auto mb-4 text-stone-300" />
            <p>Nu există întrebări în această simulare.</p>
          </div>
        )}

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
  question: ExamQuestion;
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

      {isCG && (
        <div className="mb-4 ml-10 space-y-2">
          {[1, 2, 3, 4].map((n) => {
            const text = question[`statement_${n}` as keyof ExamQuestion] as string;
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

      <div className="ml-10 grid gap-2">
        {LETTERS.map((letter) => {
          const optionText = isCG
            ? getCGLabel(letter)
            : (question[`option_${letter.toLowerCase()}` as keyof ExamQuestion] as string);

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
