import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Simulation, type ExamQuestion, type Attempt } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, Bookmark, ChevronLeft, Send } from 'lucide-react';
import Logo from '@/components/Logo';
import ExamHeaderTools from '@/components/ExamHeaderTools';
import QuestionRail from '@/components/QuestionRail';
import Loading from '@/components/Loading';
import { useVisualComfort } from '@/hooks/useVisualComfort';
import { useQuestionMarks } from '@/hooks/useQuestionMarks';
import { biologySimulationName, umfcdSimulationName } from '@/lib/materialDisplayNames';
import './SimulationView.css';
import './PracticeSetView.css';

type Props = {
  simulationId: string;
  resume?: boolean;
  onExit: () => void;
  onComplete: (attemptId: string) => void;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type RpcAttemptRow = {
  out_id: string;
  out_user_id: string;
  out_sim_id: string;
  out_answers: Record<string, string>;
  out_score: number;
  out_max_score: number;
  out_started_at: string;
  out_submitted_at: string | null;
  out_expired: boolean;
  out_expires_at: string | null;
};

function mapRpcAttempt(row: RpcAttemptRow): Attempt {
  return {
    id: row.out_id,
    user_id: row.out_user_id,
    simulation_id: row.out_sim_id,
    answers: row.out_answers || {},
    score: row.out_score,
    max_score: row.out_max_score,
    started_at: row.out_started_at,
    submitted_at: row.out_submitted_at,
    expired: row.out_expired,
    is_archive_retake: false,
    expires_at: row.out_expires_at,
  };
}

export default function SimulationView({ simulationId, resume = false, onExit, onComplete }: Props) {
  const { profile, session } = useAuth();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSeconds, setShowSeconds] = useState(true);
  const { comfortTheme, setComfortTheme } = useVisualComfort();
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [questionCount, setQuestionCount] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const { markedIds, toggleMark } = useQuestionMarks(attempt?.id ?? null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeDeadlineRef = useRef<number | null>(null);
  const timerPausedRef = useRef(false);
  const timerSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const submittedRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const attemptIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const autoResumeRef = useRef(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const syncTimer = useCallback((active: boolean): Promise<number> => {
    const attemptId = attemptIdRef.current;
    if (!attemptId) return Promise.reject(new Error('Încercarea nu este disponibilă.'));
    const request = timerSyncQueueRef.current.then(async () => {
      const { data, error: syncError } = await supabase.rpc('sync_exam_timer', {
        p_attempt_id: attemptId,
        p_active: active,
      });
      if (syncError) throw syncError;
      return Math.max(0, Number(data) || 0);
    });
    timerSyncQueueRef.current = request.then(() => undefined, () => undefined);
    return request;
  }, []);

  // Load simulation + question count
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

      const { data: qc } = await supabase.rpc('get_exam_question_count', { p_simulation_id: simulationId });
      if (qc && qc.length > 0) {
        const row = qc[0] as { question_count: number };
        setQuestionCount(Number(row.question_count));
      }

      setLoading(false);
    })();
  }, [simulationId]);

  const startAttempt = useCallback(async () => {
    if (!profile || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    try {
      for (let pass = 0; pass < 2; pass += 1) {
        const { data: att, error: startError } = await supabase
          .rpc('start_exam_attempt', { p_simulation_id: simulationId });
        if (!mountedRef.current) return;
        if (startError) {
          console.error('start_exam_attempt error:', startError);
          const msg = startError.message || '';
          if (msg.includes('Abonament necesar')) {
            setError('Ai nevoie de un abonament activ pentru a accesa această simulare.');
          } else if (msg.includes('Limita de 3 încercări')) {
            setError('Ai folosit toate cele 3 încercări pentru această simulare.');
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

        const nextAttempt = mapRpcAttempt(att[0] as unknown as RpcAttemptRow);
        if (nextAttempt.simulation_id !== simulationId) {
          setError('Încercarea primită nu aparține acestei simulări. Reîncarcă pagina și încearcă din nou.');
          return;
        }
        if (nextAttempt.submitted_at) {
          setError('S-a primit o încercare deja încheiată. Reîncarcă pagina și încearcă din nou.');
          return;
        }

        const expiresAt = nextAttempt.expires_at ? Date.parse(nextAttempt.expires_at) : NaN;
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
          const { error: expireError } = await supabase.rpc('submit_exam_attempt', {
            p_simulation_id: simulationId,
            p_answers: nextAttempt.answers || {},
            p_expired: true,
          });
          if (!mountedRef.current) return;
          if (expireError) {
            console.error('Expired exam attempt could not be finalized:', expireError);
            setError('Încercarea anterioară a expirat, dar nu a putut fi încheiată. Încearcă din nou.');
            return;
          }
          continue;
        }

        if (Number.isFinite(expiresAt)) {
          setTimeLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
          activeDeadlineRef.current = expiresAt;
        }
        timerPausedRef.current = false;
        setAttempt(nextAttempt);
        attemptIdRef.current = nextAttempt.id;
        answersRef.current = nextAttempt.answers || {};
        setAnswers(answersRef.current);
        submittedRef.current = false;
        setStarted(true);
        return;
      }
      setError('Încercarea anterioară a expirat. Reîncearcă pornirea simulării.');
    } catch (err) {
      console.error('Unexpected simulation start error:', err);
      if (mountedRef.current) setError('Nu s-a putut porni simularea. Încearcă din nou.');
    } finally {
      startingRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  }, [profile, simulationId]);

  useEffect(() => {
    if (!resume || !profile || !simulation || loading || started || error || autoResumeRef.current) return;
    autoResumeRef.current = true;
    void startAttempt();
  }, [resume, profile, simulation, loading, started, error, startAttempt]);

  // The server stores remaining time; the view consumes it only while visible.
  useEffect(() => {
    if (!started || !attempt) return;
    const tick = () => {
      if (timerPausedRef.current || document.hidden || activeDeadlineRef.current === null || submittedRef.current) return;
      const remaining = Math.max(0, Math.ceil((activeDeadlineRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        void submitAttempt(true);
      }
    };

    const heartbeat = () => {
      if (timerPausedRef.current || document.hidden || submittedRef.current) return;
      void syncTimer(true).then((remaining) => {
        if (!mountedRef.current || timerPausedRef.current || submittedRef.current) return;
        activeDeadlineRef.current = Date.now() + remaining * 1000;
        setTimeLeft(remaining);
        if (remaining === 0) void submitAttempt(true);
      }).catch((syncError) => console.error('Exam timer sync error:', syncError));
    };

    const handleVisibility = () => {
      if (document.hidden) {
        timerPausedRef.current = true;
        activeDeadlineRef.current = null;
        void syncTimer(false).then((remaining) => {
          if (mountedRef.current) setTimeLeft(remaining);
        }).catch((syncError) => console.error('Exam timer pause error:', syncError));
      } else {
        timerPausedRef.current = false;
        void syncTimer(true).then((remaining) => {
          if (!mountedRef.current || timerPausedRef.current) return;
          activeDeadlineRef.current = Date.now() + remaining * 1000;
          setTimeLeft(remaining);
          if (remaining === 0) void submitAttempt(true);
        }).catch((syncError) => console.error('Exam timer resume error:', syncError));
      }
    };

    if (document.hidden) handleVisibility();
    else if (!attempt.expires_at) void submitAttempt(true);
    tick();
    timerRef.current = setInterval(tick, 1000);
    const heartbeatInterval = window.setInterval(heartbeat, 5000);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, attempt?.id, syncTimer]);

  // Load questions once started
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
  }, [started, simulation, attempt, simulationId]);

  useEffect(() => {
    if (!started || questions.length === 0) return;
    let frame = 0;
    const updateActiveQuestion = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        let current = 0;
        questions.forEach((question, index) => {
          const element = document.getElementById(`exam-question-${question.id}`);
          if (element && element.getBoundingClientRect().top <= window.innerHeight * 0.35) current = index;
        });
        setActiveQuestion(current);
      });
    };
    updateActiveQuestion();
    window.addEventListener('scroll', updateActiveQuestion, { passive: true });
    window.addEventListener('resize', updateActiveQuestion);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateActiveQuestion);
      window.removeEventListener('resize', updateActiveQuestion);
    };
  }, [started, questions]);

  // Auto-save with debounce
  const saveProgress = useCallback(async (answersToSave: Record<string, string>) => {
    if (!attemptIdRef.current || submittedRef.current) return;
    setSaveState('saving');
    try {
      const { error: saveError } = await supabase.rpc('save_attempt_progress', {
        p_attempt_id: attemptIdRef.current,
        p_answers: answersToSave,
      });
      if (saveError) {
        console.error('save_attempt_progress error:', saveError);
        setSaveState('error');
      } else {
        setSaveState('saved');
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveState('error');
    }
  }, []);

  const submitAttempt = useCallback(
    async (expired: boolean) => {
      if (!mountedRef.current || submittedRef.current || !profile || !simulation) return;
      submittedRef.current = true;
      setSubmitting(true);

      // Save before submitting
      const finalAnswers = answersRef.current;
      if (attemptIdRef.current && Object.keys(finalAnswers).length > 0) {
        try {
          await supabase.rpc('save_attempt_progress', {
            p_attempt_id: attemptIdRef.current,
            p_answers: finalAnswers,
          });
        } catch (err) {
          console.error('Pre-submit save error:', err);
        }
      }

      const { data, error: submitError } = await supabase
        .rpc('submit_exam_attempt', {
          p_simulation_id: simulationId,
          p_answers: finalAnswers,
          p_expired: expired,
        });

      if (!mountedRef.current) return;

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
        const submitted = mapRpcAttempt(data[0] as unknown as RpcAttemptRow);
        if (submitted.id !== attemptIdRef.current || submitted.simulation_id !== simulationId) {
          setError('Răspunsul primit nu corespunde încercării curente. Verifică istoricul înainte de a relua.');
          submittedRef.current = false;
          setSubmitting(false);
          return;
        }
        setSubmitting(false);
        onComplete(submitted.id);
      } else {
        setError('Nu am primit confirmarea trimiterii. Verifică istoricul înainte de a relua.');
        submittedRef.current = false;
        setSubmitting(false);
      }
    },
    [profile, simulation, simulationId, onComplete]
  );

  const handleAnswer = (questionId: string, letter: string) => {
    const newAnswers = { ...answersRef.current, [questionId]: letter };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);

    // Debounced auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProgress(newAnswers);
    }, 800);
  };

  const handleExit = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const previousDeadline = activeDeadlineRef.current;
    if (started && attemptIdRef.current && !submittedRef.current) {
      timerPausedRef.current = true;
      activeDeadlineRef.current = null;
      try {
        setTimeLeft(await syncTimer(false));
      } catch (syncError) {
        console.error('Pause before exit error:', syncError);
        setSaveState('error');
        if (!document.hidden) {
          timerPausedRef.current = false;
          activeDeadlineRef.current = previousDeadline;
        }
        return;
      }
    }
    if (started && attemptIdRef.current && !submittedRef.current && Object.keys(answersRef.current).length > 0) {
      try {
        const { error: saveError } = await supabase.rpc('save_attempt_progress', {
          p_attempt_id: attemptIdRef.current,
          p_answers: answersRef.current,
        });
        if (saveError) throw saveError;
      } catch (saveError) {
        console.error('Save before exit error:', saveError);
        setSaveState('error');
        if (!document.hidden) {
          timerPausedRef.current = false;
          try {
            const remaining = await syncTimer(true);
            activeDeadlineRef.current = Date.now() + remaining * 1000;
            setTimeLeft(remaining);
          } catch (resumeError) {
            console.error('Resume after failed exit error:', resumeError);
            timerPausedRef.current = true;
          }
        }
        return;
      }
    }
    onExit();
  };

  // Save before unload
  useEffect(() => {
    if (!started) return;
    const handleBeforeUnload = () => {
      if (session?.access_token && attemptIdRef.current && !submittedRef.current) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        timerPausedRef.current = true;
        activeDeadlineRef.current = null;
        try {
          void fetch(`${supabaseUrl}/rest/v1/rpc/sync_exam_timer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ p_attempt_id: attemptIdRef.current, p_active: false }),
            keepalive: true,
          });
        } catch {
          // The heartbeat limits time loss if the browser cannot send this request.
        }
      }
      if (session?.access_token && attemptIdRef.current && !submittedRef.current && Object.keys(answersRef.current).length > 0) {
        // Use sendBeacon-style fire-and-forget via fetch with keepalive
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const body = JSON.stringify({
          p_attempt_id: attemptIdRef.current,
          p_answers: answersRef.current,
        });
        try {
          fetch(`${supabaseUrl}/rest/v1/rpc/save_attempt_progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${session.access_token}`,
            },
            body,
            keepalive: true,
          });
        } catch {
          // Best effort
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (!mountedRef.current && !timerPausedRef.current && !submittedRef.current) handleBeforeUnload();
    };
  }, [started, session?.access_token]);

  if (loading) return <Loading message="Se încarcă simularea..." />;

  if (!simulation) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        <p>Simularea nu a fost găsită.</p>
      </div>
    );
  }

  const displayName = simulation.student_section === 'all'
    ? biologySimulationName(simulation.display_order ?? 1)
    : umfcdSimulationName(simulation);

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <AlertTriangle size={32} className="mx-auto mb-4 text-red-500" />
          <p className="text-stone-700 font-medium mb-2">A apărut o eroare</p>
          <p className="text-sm text-stone-500 mb-6">{error}</p>
          <button onClick={handleExit} className="btn-secondary">
            <ChevronLeft size={16} /> Înapoi
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className={`simulation-intro ${simulation.student_section === 'umfcd' ? 'simulation-intro--umfcd' : ''}`}>
        <header className="simulation-intro__header">
          <div className="simulation-intro__header-inner">
            <div className="simulation-intro__brand">
              <Logo showText linked={false} />
            </div>
            <button onClick={handleExit} className="simulation-intro__home" type="button" aria-label="Acasă">
              <img src="/Home.png" alt="" width={22} height={22} /><span>Acasă</span>
            </button>
          </div>
        </header>
        <main className="simulation-intro__main">
          <section className="simulation-intro__editorial" aria-labelledby="simulation-intro-title">
            <p className="simulation-intro__eyebrow">{simulation.student_section === 'umfcd' ? 'EXAMENE UMFCD' : 'SIMULARE BIOLOGIE'}</p>
            <h1 id="simulation-intro-title">Înainte să începi</h1>
            <p className="simulation-intro__lead">Rezervă-ți timpul și intră în ritmul de examen.</p>
            <div className="simulation-intro__rule" />
            <h2>De știut înainte de start</h2>
            <ol className="simulation-intro__steps">
              <li><span className="simulation-intro__step-number">1</span><span>Răspunsurile <strong>se salvează automat</strong> pe măsură ce rezolvi grilele.</span></li>
              <li><span className="simulation-intro__step-number">2</span><span><strong>Revino la set când dorești.</strong> Cronometrul pornește din nou doar când reiei rezolvarea.</span></li>
              <li><span className="simulation-intro__step-number">3</span><span>La expirare, răspunsurile <strong>se trimit automat.</strong></span></li>
            </ol>
          </section>

          <div className="simulation-intro__right">
            <p className="simulation-intro__wish">
              <span className="simulation-intro__wish-mult">Mult</span>
              <span className="simulation-intro__wish-succes">succes!</span>
            </p>
            <section className="simulation-intro__card" aria-labelledby="simulation-intro-summary">
              <h2 id="simulation-intro-summary">{displayName}</h2>
              <div className="simulation-intro__stats">
                <p><strong>{questionCount}</strong> {questionCount === 1 ? 'grilă' : 'grile'}</p>
                <p><strong>{simulation.duration_minutes}</strong> min</p>
              </div>
              <div className="simulation-intro__actions">
                <button onClick={startAttempt} className="simulation-intro__start" type="button" disabled={starting}>
                  {starting ? 'Se pornește…' : 'Începe simularea'}
                </button>
                <button onClick={handleExit} className="simulation-intro__later" type="button">
                  Nu acum
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const activeQuestionId = questions[activeQuestion]?.id;
  const categoryName = simulation.student_section === 'umfcd' ? 'Examene UMFCD' : 'Simulări biologie';
  const ringSeconds = timeLeft >= 3600 || !showSeconds ? Math.ceil(timeLeft / 60) * 60 : timeLeft;
  const ringProgress = Math.min(100, Math.max(0, 100 * ringSeconds / Math.max(1, simulation.duration_minutes * 60)));

  return (
    <div className={`practice-exam${comfortTheme === 'light' ? '' : ` practice-exam--${comfortTheme}`}`}>
      <header className="practice-exam__header">
        <div className="practice-exam__header-inner">
          <div className="practice-exam__brand">
            <Logo showText linked={false} />
          </div>
          <nav className="practice-exam__breadcrumb" aria-label="Locația curentă">
            <button type="button" onClick={handleExit}>{categoryName}</button>
            <span aria-hidden="true">/</span>
            <strong>{displayName}</strong>
          </nav>
          <ExamHeaderTools comfortTheme={comfortTheme} onComfortChange={setComfortTheme} onHome={() => void handleExit()} homeVariant={simulation.student_section === 'umfcd' ? 'umfcd' : 'biology'} />
        </div>
      </header>

      <div className="practice-exam__layout">
        <QuestionRail questionIds={questions.map((question) => question.id)} answers={answers} markedIds={markedIds} activeIndex={activeQuestion} questionIdPrefix="exam-question-" />

        <main className="practice-exam__questions" aria-label="Grilele simulării">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              selectedAnswer={answers[q.id]}
              onSelect={(letter) => handleAnswer(q.id, letter)}
            />
          ))}

          {questions.length === 0 && <p className="practice-exam__empty">Nu există întrebări în această simulare.</p>}

          {questions.length > 0 && (
            <footer className="practice-exam__footer">
              <span>Ai ajuns la finalul setului.</span>
              <button type="button" onClick={() => void submitAttempt(false)} disabled={submitting}>
                {submitting ? 'Se trimite…' : 'Trimite răspunsurile'}
              </button>
            </footer>
          )}
        </main>

        <aside className="practice-exam__progress" aria-label="Progresul simulării">
          <div className="practice-exam__sticky">
            <span className="practice-exam__section-label">Parcurs</span>
            <p><strong>{answeredCount}</strong> din {questions.length} completate</p>
            {saveState !== 'idle' && (
              <p className="practice-exam__save" role="status">
                {saveState === 'saving' && 'Se salvează…'}
                {saveState === 'saved' && 'Progres salvat'}
                {saveState === 'error' && 'Salvarea a eșuat'}
              </p>
            )}
            <div className="practice-exam__progress-track" role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={questions.length} aria-label="Grile completate">
              <span style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
            </div>
            <div className={`practice-exam__timer-ring${timeLeft < 300 ? ' practice-exam__timer-ring--urgent' : ''}`}>
              <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">
                <circle className="practice-exam__timer-ring-track" cx="120" cy="120" r="86" />
                <circle className="practice-exam__timer-ring-accent" cx="120" cy="120" r="86" pathLength="100" strokeDasharray={`${ringProgress} 100`} />
              </svg>
              <button
                type="button"
                className="practice-exam__timer-value"
                disabled={timeLeft >= 3600}
                aria-pressed={timeLeft < 3600 ? !showSeconds : undefined}
                aria-label={`Timp rămas: ${formatTime(timeLeft, showSeconds)}${timeLeft < 3600 ? `. ${showSeconds ? 'Ascunde secundele' : 'Afișează secundele'}` : ''}`}
                onClick={() => setShowSeconds((current) => !current)}
              >{formatTime(timeLeft, showSeconds)}</button>
            </div>
            <div className="practice-exam__side-actions">
              <button className="practice-exam__side-action" type="button" disabled={!activeQuestionId} aria-pressed={activeQuestionId ? markedIds.has(activeQuestionId) : false} onClick={() => { if (activeQuestionId) toggleMark(activeQuestionId); }}>
                <Bookmark size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{activeQuestionId && markedIds.has(activeQuestionId) ? 'Demarchează grila' : 'Marchează grila'}</span>
              </button>
            </div>
            <button className="practice-exam__submit" type="button" onClick={() => void submitAttempt(false)} disabled={submitting || questions.length === 0}>
              <span>{submitting ? 'Se trimite…' : 'Trimite răspunsurile'}</span>
              <Send size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatTime(seconds: number, showSeconds = true) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  const s = showSeconds ? seconds % 60 : 0;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
    <section className="practice-exam__question" id={`exam-question-${question.id}`} aria-labelledby={`exam-question-title-${question.id}`}>
      <p className="practice-exam__eyebrow">Întrebarea {index + 1} <span aria-hidden="true">/</span> {isCG ? 'Complement grupat' : 'Complement simplu'}</p>
      <h2 id={`exam-question-title-${question.id}`}>{question.question_text}</h2>

      {isCG && (
        <div className="practice-exam__statements">
          {[1, 2, 3, 4].map((n) => {
            const text = question[`statement_${n}` as keyof ExamQuestion] as string;
            if (!text) return null;
            return (
              <div key={n} className="practice-exam__statement">
                <span>{n}.</span>
                <span>{text}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="practice-exam__options" role="group" aria-label={`Răspunsuri pentru întrebarea ${index + 1}`}>
        {LETTERS.map((letter) => {
          const optionText = isCG
            ? getCGLabel(letter)
            : (question[`option_${letter.toLowerCase()}` as keyof ExamQuestion] as string);

          if (!optionText && !isCG) return null;

          const isSelected = selectedAnswer === letter;

          return (
            <button
              key={letter}
              type="button"
              onClick={() => onSelect(letter)}
              className={`practice-exam__option${isSelected ? ' practice-exam__option--selected' : ''}`}
              aria-pressed={isSelected}
            >
              <span className="practice-exam__option-letter">{letter}</span>
              <span className="practice-exam__option-text">{optionText}</span>
            </button>
          );
        })}
      </div>
    </section>
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
