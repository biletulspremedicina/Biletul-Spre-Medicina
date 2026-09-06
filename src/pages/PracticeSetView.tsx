import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type PracticeQuestionRPC } from '@/lib/supabase';
import {
  ChevronLeft, Send, AlertTriangle, Loader2, FileText, Save, CheckCircle2, XCircle,
} from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';

type Props = {
  setId: string;
  onExit: () => void;
  onComplete: (attemptId: string) => void;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function PracticeSetView({ setId, onExit, onComplete }: Props) {
  const [questions, setQuestions] = useState<PracticeQuestionRPC[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [started, setStarted] = useState(false);

  const answersRef = useRef<Record<string, string>>({});
  const attemptIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start or resume attempt
  const startAttempt = useCallback(async () => {
    setError(null);
    const { data, error: startError } = await supabase.rpc('start_practice_attempt', {
      p_set_id: setId,
    });

    if (startError) {
      const msg = startError.message || '';
      if (msg.includes('Abonament necesar')) {
        setError('Ai nevoie de un abonament activ pentru a accesa acest set.');
      } else if (msg.includes('nu este disponibil')) {
        setError('Acest set nu este disponibil momentan.');
      } else {
        setError('Nu s-a putut porni setul. Încearcă din nou.');
      }
      return;
    }

    if (!data || data.length === 0) {
      setError('Nu s-a putut crea încercarea.');
      return;
    }

    const att = data[0] as { out_id: string; out_answers: Record<string, string>; out_submitted_at: string | null };
    attemptIdRef.current = att.out_id;

    if (att.out_submitted_at) {
      onComplete(att.out_id);
      return;
    }

    if (att.out_answers && Object.keys(att.out_answers).length > 0) {
      answersRef.current = att.out_answers as Record<string, string>;
      setAnswers(att.out_answers as Record<string, string>);
    }
    setStarted(true);
  }, [setId, onComplete]);

  useEffect(() => {
    startAttempt();
  }, [startAttempt]);

  // Load questions once started
  useEffect(() => {
    if (!started) return;
    (async () => {
      const { data: qs, error: qError } = await supabase.rpc('get_practice_questions', {
        p_set_id: setId,
      });
      if (qError) {
        setError('Nu s-au putut încărca întrebările.');
        return;
      }
      setQuestions((qs || []) as unknown as PracticeQuestionRPC[]);
      setLoading(false);
    })();
  }, [started, setId]);

  const saveProgress = useCallback(async (answersToSave: Record<string, string>) => {
    if (!attemptIdRef.current || submittedRef.current) return;
    setSaveState('saving');
    try {
      const { error: saveError } = await supabase.rpc('save_practice_progress', {
        p_attempt_id: attemptIdRef.current,
        p_answers: answersToSave,
      });
      if (saveError) {
        setSaveState('error');
      } else {
        setSaveState('saved');
      }
    } catch {
      setSaveState('error');
    }
  }, []);

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    const finalAnswers = answersRef.current;

    if (attemptIdRef.current && Object.keys(finalAnswers).length > 0) {
      try {
        await supabase.rpc('save_practice_progress', {
          p_attempt_id: attemptIdRef.current,
          p_answers: finalAnswers,
        });
      } catch {
        // best effort
      }
    }

    const { data, error: submitError } = await supabase.rpc('submit_practice_attempt', {
      p_set_id: setId,
      p_answers: finalAnswers,
    });

    if (submitError) {
      const msg = submitError.message || '';
      if (msg.includes('Abonament necesar')) {
        setError('Abonamentul nu mai este activ.');
      } else {
        setError('Nu s-a putut trimite setul. Încearcă din nou.');
      }
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }

    if (data && data.length > 0) {
      const result = data[0] as { out_id: string };
      setSubmitting(false);
      onComplete(result.out_id);
    }
  }, [setId, onComplete]);

  const handleAnswer = (questionId: string, letter: string) => {
    const newAnswers = { ...answersRef.current, [questionId]: letter };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProgress(newAnswers);
    }, 800);
  };

  // Save before unload
  useEffect(() => {
    if (!started) return;
    const handleBeforeUnload = () => {
      if (attemptIdRef.current && !submittedRef.current && Object.keys(answersRef.current).length > 0) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        try {
          fetch(`${supabaseUrl}/rest/v1/rpc/save_practice_progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              p_attempt_id: attemptIdRef.current,
              p_answers: answersRef.current,
            }),
            keepalive: true,
          });
        } catch {
          // best effort
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [started]);

  if (loading) return <Loading message="Se încarcă setul de grile..." />;

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

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="text-sm font-medium text-stone-700 hidden sm:inline">Set de grile</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {saveState !== 'idle' && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-stone-500">
                {saveState === 'saving' && <><Save size={12} /> Se salvează…</>}
                {saveState === 'saved' && <><CheckCircle2 size={12} className="text-brand-600" /> Progres salvat</>}
                {saveState === 'error' && <><XCircle size={12} className="text-red-500" /> Salvarea a eșuat</>}
              </span>
            )}
            <button
              onClick={() => submitAttempt()}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              <Send size={16} />
              <span className="hidden sm:inline">Trimite</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between text-sm text-stone-500">
          <span>{answeredCount} din {questions.length} grile completate</span>
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
              key={q.out_id}
              question={q}
              index={idx}
              selectedAnswer={answers[q.out_id]}
              onSelect={(letter) => handleAnswer(q.out_id, letter)}
            />
          ))}
        </div>

        {questions.length === 0 && (
          <div className="card p-12 text-center text-stone-500">
            <FileText size={40} className="mx-auto mb-4 text-stone-300" />
            <p>Nu există întrebări în acest set.</p>
          </div>
        )}

        {questions.length > 0 && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => submitAttempt()}
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

function QuestionCard({
  question, index, selectedAnswer, onSelect,
}: {
  question: PracticeQuestionRPC;
  index: number;
  selectedAnswer: string | undefined;
  onSelect: (letter: string) => void;
}) {
  const isCG = question.out_type === 'CG';

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
          <p className="text-stone-900 font-medium leading-relaxed">{question.out_question_text}</p>
        </div>
      </div>

      {isCG && (
        <div className="mb-4 ml-10 space-y-2">
          {[1, 2, 3, 4].map((n) => {
            const text = question[`out_statement_${n}` as keyof PracticeQuestionRPC] as string;
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
            : (question[`out_option_${letter.toLowerCase()}` as keyof PracticeQuestionRPC] as string);

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
