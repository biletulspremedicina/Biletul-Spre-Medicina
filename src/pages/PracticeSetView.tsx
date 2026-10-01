import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type PracticeQuestionRPC, type PracticeSetRPC } from '@/lib/supabase';
import {
  ChevronLeft, Send, AlertTriangle, Loader2, FileText, Save, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';
import { practiceSetName } from '@/lib/materialDisplayNames';
import './SimulationView.css';

type Props = {
  setId: string;
  onExit: () => void;
  onHome: () => void;
  onComplete: (attemptId: string) => void;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
const MAX_TIME_LIMIT_MINUTES = 1440;
const practiceTimerKey = (attemptId: string) => `bsm-practice-timer:${attemptId}`;

function readPracticeDeadline(attemptId: string): number | null {
  try {
    const saved = window.localStorage.getItem(practiceTimerKey(attemptId));
    if (!saved) return null;
    const deadline = Number(saved);
    return Number.isFinite(deadline) && deadline > 0 ? deadline : null;
  } catch {
    return null;
  }
}

function savePracticeDeadline(attemptId: string, deadline: number) {
  try {
    window.localStorage.setItem(practiceTimerKey(attemptId), String(deadline));
  } catch {
    // The timer still works for the current session if storage is unavailable.
  }
}

function clearPracticeDeadline(attemptId: string) {
  try {
    window.localStorage.removeItem(practiceTimerKey(attemptId));
  } catch {
    // Best effort.
  }
}

function formatPracticeTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type IntroMeta = {
  lessonTitle: string;
  position: number;
  questionCount: number;
};

export default function PracticeSetView({ setId, onExit, onHome, onComplete }: Props) {
  const [questions, setQuestions] = useState<PracticeQuestionRPC[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [started, setStarted] = useState(false);
  const [introMeta, setIntroMeta] = useState<IntroMeta | null>(null);
  const [minutesInput, setMinutesInput] = useState('');
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const answersRef = useRef<Record<string, string>>({});
  const attemptIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitTriggeredRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: set, error: setLookupError } = await supabase
        .from('practice_sets')
        .select('lesson_id')
        .eq('id', setId)
        .maybeSingle();
      if (!active) return;
      if (setLookupError || !set) {
        setError('Setul nu a fost găsit.');
        setLoading(false);
        return;
      }

      const [lessonResult, setsResult] = await Promise.all([
        supabase.from('practice_lessons').select('title').eq('id', set.lesson_id).maybeSingle(),
        supabase.rpc('get_practice_sets', { p_lesson_id: set.lesson_id }),
      ]);
      if (!active) return;
      const selectedSet = ((setsResult.data || []) as PracticeSetRPC[])
        .find((item) => item.out_id === setId);
      if (lessonResult.error || !lessonResult.data || setsResult.error || !selectedSet) {
        setError('Nu s-au putut încărca detaliile setului.');
      } else {
        setIntroMeta({
          lessonTitle: lessonResult.data.title,
          position: selectedSet.out_position,
          questionCount: selectedSet.out_question_count,
        });
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [setId]);

  // Start or resume attempt
  const startAttempt = useCallback(async () => {
    const selectedMinutes = minutesInput.trim() === '' ? null : Number(minutesInput);
    if (selectedMinutes !== null && (
      !Number.isInteger(selectedMinutes) || selectedMinutes < 1 || selectedMinutes > MAX_TIME_LIMIT_MINUTES
    )) {
      setMinutesError(`Introdu un număr întreg între 1 și ${MAX_TIME_LIMIT_MINUTES} sau lasă câmpul gol.`);
      return;
    }
    setMinutesError(null);
    setError(null);
    setLoading(true);
    const { data, error: startError } = await supabase.rpc('start_practice_attempt', {
      p_set_id: setId,
    });

    if (startError) {
      const msg = startError.message || '';
      if (msg.includes('Abonament necesar')) {
        setError('Ai nevoie de un abonament activ pentru a accesa acest set.');
      } else if (msg.includes('Limita de 3 încercări')) {
        setError('Acest set a fost deja lucrat. Ai folosit toate cele 3 încercări.');
      } else if (msg.includes('nu este disponibil')) {
        setError('Acest set nu este disponibil momentan.');
      } else {
        setError('Nu s-a putut porni setul. Încearcă din nou.');
      }
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setError('Nu s-a putut crea încercarea.');
      setLoading(false);
      return;
    }

    const att = data[0] as { out_id: string; out_answers: Record<string, string>; out_submitted_at: string | null };
    attemptIdRef.current = att.out_id;

    if (att.out_submitted_at) {
      clearPracticeDeadline(att.out_id);
      onComplete(att.out_id);
      return;
    }

    const savedDeadline = readPracticeDeadline(att.out_id);
    const nextDeadline = savedDeadline ?? (selectedMinutes === null ? null : Date.now() + selectedMinutes * 60_000);
    if (savedDeadline === null && nextDeadline !== null) savePracticeDeadline(att.out_id, nextDeadline);
    setDeadline(nextDeadline);
    setTimeLeft(nextDeadline === null ? null : Math.max(0, Math.ceil((nextDeadline - Date.now()) / 1000)));
    autoSubmitTriggeredRef.current = false;

    if (att.out_answers && Object.keys(att.out_answers).length > 0) {
      answersRef.current = att.out_answers as Record<string, string>;
      setAnswers(att.out_answers as Record<string, string>);
    }
    setStarted(true);
  }, [setId, onComplete, minutesInput]);

  // Load questions once started
  useEffect(() => {
    if (!started) return;
    (async () => {
      const { data: qs, error: qError } = await supabase.rpc('get_practice_questions', {
        p_set_id: setId,
      });
      if (qError) {
        setError('Nu s-au putut încărca întrebările.');
        setLoading(false);
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
      if (attemptIdRef.current) clearPracticeDeadline(attemptIdRef.current);
      setSubmitting(false);
      onComplete(result.out_id);
    }
  }, [setId, onComplete]);

  useEffect(() => {
    if (!started || deadline === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        void submitAttempt();
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [started, deadline, submitAttempt]);

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

  if (!started && introMeta) {
    const displayName = practiceSetName(introMeta.lessonTitle, introMeta.position);
    return (
      <div className="simulation-intro simulation-intro--practice">
        <header className="simulation-intro__header">
          <div className="simulation-intro__header-inner">
            <div className="simulation-intro__brand">
              <div className="simulation-intro__brand-mobile"><Logo size="sm" /></div>
              <div className="simulation-intro__brand-desktop"><Logo /></div>
              <span className="simulation-intro__brand-name" aria-hidden="true">
                <span>Biletul</span><span>Spre</span><span>Medicină</span>
              </span>
            </div>
            <button onClick={onHome} className="simulation-intro__home" type="button" aria-label="Acasă">
              <img src="/Home.png" alt="" width={22} height={22} /><span>Acasă</span>
            </button>
          </div>
        </header>
        <main className="simulation-intro__main">
          <section className="simulation-intro__editorial" aria-labelledby="practice-intro-title">
            <p className="simulation-intro__eyebrow">ANTRENAMENT PE CAPITOLE</p>
            <h1 id="practice-intro-title">Înainte să începi</h1>
            <p className="simulation-intro__lead">Lucrează setul în ritmul tău.</p>
            <div className="simulation-intro__rule" />
            <h2>De știut înainte de start</h2>
            <ol className="simulation-intro__steps">
              <li><span className="simulation-intro__step-number">1</span><span>Poți introduce timpul-limită pentru acest set.<strong className="simulation-intro__step-note">Câmp gol = Fără limită</strong></span></li>
              <li><span className="simulation-intro__step-number">2</span><span>Poți reveni la set; cronometrul continuă dacă l-ai activat.</span></li>
              <li><span className="simulation-intro__step-number">3</span><span>La expirare, răspunsurile <strong>se trimit automat.</strong></span></li>
            </ol>
          </section>

          <div className="simulation-intro__right">
            <p className="simulation-intro__wish">
              <span className="simulation-intro__wish-mult">Mult</span>
              <span className="simulation-intro__wish-succes">succes!</span>
            </p>
            <section className="simulation-intro__card" aria-labelledby="practice-intro-summary">
              <h2 id="practice-intro-summary">{displayName}</h2>
              {displayName !== `${introMeta.lessonTitle} ${String(introMeta.position).padStart(2, '0')}` && (
                <p className="simulation-intro__description">{introMeta.lessonTitle}</p>
              )}
              <div className="simulation-intro__stats">
                <p><strong>{introMeta.questionCount}</strong> {introMeta.questionCount === 1 ? 'grilă' : 'grile'}</p>
                <label className="simulation-intro__time-field">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={minutesInput}
                    onChange={(event) => {
                      if (/^\d{0,4}$/.test(event.target.value)) {
                        setMinutesInput(event.target.value);
                        setMinutesError(null);
                      }
                    }}
                    aria-label="Timp-limită în minute; lasă gol pentru a lucra fără cronometru"
                    aria-invalid={!!minutesError}
                    aria-describedby={minutesError ? 'practice-time-error' : undefined}
                  />
                  <span>minute</span>
                </label>
              </div>
              {minutesError && <p id="practice-time-error" className="simulation-intro__time-error" role="alert">{minutesError}</p>}
              <div className="simulation-intro__actions">
                <button onClick={startAttempt} className="simulation-intro__start" type="button">Începe setul</button>
                <button onClick={onExit} className="simulation-intro__later" type="button">Nu acum</button>
              </div>
            </section>
          </div>
        </main>
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
            {timeLeft !== null && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-700'}`}
                role="timer" aria-label={`Timp rămas: ${formatPracticeTime(timeLeft)}`}>
                <Clock size={16} aria-hidden="true" />
                <span aria-hidden="true">{formatPracticeTime(timeLeft)}</span>
              </div>
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
