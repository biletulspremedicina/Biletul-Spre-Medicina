import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type PracticeQuestionRPC, type PracticeSetRPC } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, AlertTriangle, Bookmark, Send } from 'lucide-react';
import Logo from '@/components/Logo';
import ExamHeaderTools from '@/components/ExamHeaderTools';
import QuestionRail from '@/components/QuestionRail';
import Loading from '@/components/Loading';
import { useVisualComfort } from '@/hooks/useVisualComfort';
import { useQuestionMarks } from '@/hooks/useQuestionMarks';
import { practiceSetName } from '@/lib/materialDisplayNames';
import './SimulationView.css';
import './PracticeSetView.css';

type Props = {
  setId: string;
  resume?: boolean;
  lessonId?: string;
  lessonTitle?: string;
  onExit: () => void;
  onHome: () => void;
  onComplete: (attemptId: string) => void;
  canStart: () => Promise<boolean>;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
const MAX_TIME_LIMIT_MINUTES = 1440;
const practiceTimerKey = (attemptId: string) => `bsm-practice-timer:${attemptId}`;
const practiceTimerDurationKey = (attemptId: string) => `bsm-practice-timer-duration:${attemptId}`;
const practiceTimerRemainingKey = (attemptId: string) => `bsm-practice-timer-remaining:${attemptId}`;

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

function readPracticeTimerDuration(attemptId: string): number | null {
  try {
    const duration = Number(window.localStorage.getItem(practiceTimerDurationKey(attemptId)));
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

function readPracticeRemaining(attemptId: string): number | null {
  try {
    const saved = window.localStorage.getItem(practiceTimerRemainingKey(attemptId));
    if (saved === null) return null;
    const remaining = Number(saved);
    return Number.isFinite(remaining) && remaining >= 0 ? remaining : null;
  } catch {
    return null;
  }
}

function savePracticeRemaining(attemptId: string, remaining: number) {
  try {
    window.localStorage.setItem(practiceTimerRemainingKey(attemptId), String(remaining));
  } catch {
    // Best effort; the current session still keeps the timer in memory.
  }
}

function savePracticeDeadline(attemptId: string, deadline: number, duration: number) {
  try {
    window.localStorage.setItem(practiceTimerKey(attemptId), String(deadline));
    window.localStorage.setItem(practiceTimerDurationKey(attemptId), String(duration));
  } catch {
    // The timer still works for the current session if storage is unavailable.
  }
}

function clearPracticeDeadline(attemptId: string) {
  try {
    window.localStorage.removeItem(practiceTimerKey(attemptId));
    window.localStorage.removeItem(practiceTimerDurationKey(attemptId));
    window.localStorage.removeItem(practiceTimerRemainingKey(attemptId));
  } catch {
    // Best effort.
  }
}

function formatPracticeTime(seconds: number, showSeconds = true) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const remainingSeconds = showSeconds ? seconds % 60 : 0;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type IntroMeta = {
  lessonTitle: string;
  position: number;
  questionCount: number;
};

export default function PracticeSetView({ setId, lessonId, lessonTitle, onExit, onHome, onComplete, canStart }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [questions, setQuestions] = useState<PracticeQuestionRPC[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [started, setStarted] = useState(false);
  const [introMeta, setIntroMeta] = useState<IntroMeta | null>(null);
  const [introAttemptId, setIntroAttemptId] = useState<string | null>(null);
  const [introRemaining, setIntroRemaining] = useState<number | null>(null);
  const resume = introAttemptId !== null;
  const [minutesInput, setMinutesInput] = useState('');
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerDuration, setTimerDuration] = useState<number | null>(null);
  const [showSeconds, setShowSeconds] = useState(true);
  const { comfortTheme, setComfortTheme } = useVisualComfort();
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [markAttemptId, setMarkAttemptId] = useState<string | null>(null);
  const { markedIds, toggleMark } = useQuestionMarks(markAttemptId);

  const deadlineRef = useRef<number | null>(null);
  const timeLeftRef = useRef<number | null>(null);
  const timerPausedRef = useRef(false);

  const answersRef = useRef<Record<string, string>>({});
  const attemptIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitTriggeredRef = useRef(false);
  const mountedRef = useRef(true);
  const startingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!userId) return;
    (async () => {
      setLoading(true);
      setIntroAttemptId(null);
      setIntroRemaining(null);
      let resolvedLessonId = lessonId;
      if (!resolvedLessonId) {
        const { data: set, error: setLookupError } = await supabase
          .from('practice_sets')
          .select('lesson_id')
          .eq('id', setId)
          .maybeSingle();
        if (!active) return;
        if (setLookupError || !set) {
          if (setLookupError) console.error('practice_sets lookup error:', setLookupError);
          setError('Nu s-au putut încărca datele setului. Întoarce-te la capitol și deschide setul din nou.');
          setLoading(false);
          return;
        }
        resolvedLessonId = set.lesson_id;
      }

      const setsResult = await supabase.rpc('get_practice_sets', { p_lesson_id: resolvedLessonId });
      if (!active) return;
      const selectedSet = ((setsResult.data || []) as PracticeSetRPC[])
        .find((item) => item.out_id === setId);
      if (setsResult.error || !selectedSet) {
        if (setsResult.error) console.error('get_practice_sets error:', setsResult.error);
        setError('Setul nu mai este disponibil în acest capitol. Reîncarcă lista și încearcă din nou.');
        setLoading(false);
        return;
      }
      let resolvedLessonTitle = lessonTitle;
      if (!resolvedLessonTitle) {
        const { data: lesson, error: lessonError } = await supabase
          .from('practice_lessons')
          .select('title')
          .eq('id', resolvedLessonId)
          .maybeSingle();
        if (!active) return;
        if (lessonError) console.error('practice_lessons lookup error:', lessonError);
        resolvedLessonTitle = lesson?.title || 'Capitol';
      }
      const { data: openAttempt, error: attemptError } = await supabase
        .from('practice_attempts').select('id')
        .eq('set_id', setId).eq('user_id', userId)
        .is('submitted_at', null).order('started_at', { ascending: false })
        .limit(1).maybeSingle();
      if (!active) return;
      if (attemptError) {
        setError('Nu s-a putut încărca progresul salvat. Reîncarcă setul și încearcă din nou.');
        setLoading(false);
        return;
      }
      if (openAttempt) {
        const savedRemaining = readPracticeRemaining(openAttempt.id);
        const savedDeadline = readPracticeDeadline(openAttempt.id);
        setIntroAttemptId(openAttempt.id);
        setIntroRemaining(savedRemaining ?? (savedDeadline === null
          ? null : Math.max(0, Math.ceil((savedDeadline - Date.now()) / 1000))));
      }
      setIntroMeta({
        lessonTitle: resolvedLessonTitle || 'Capitol',
        position: selectedSet.out_position + 1,
        questionCount: selectedSet.out_question_count,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [setId, lessonId, lessonTitle, userId]);

  // Start or resume attempt
  const startAttempt = useCallback(async () => {
    if (startingRef.current) return;
    const selectedMinutes = resume || minutesInput.trim() === '' ? null : Number(minutesInput);
    if (selectedMinutes !== null && (
      !Number.isInteger(selectedMinutes) || selectedMinutes < 1 || selectedMinutes > MAX_TIME_LIMIT_MINUTES
    )) {
      setMinutesError(`Introdu un număr întreg între 1 și ${MAX_TIME_LIMIT_MINUTES} sau lasă câmpul gol.`);
      return;
    }
    startingRef.current = true;
    setMinutesError(null);
    setError(null);
    setLoading(true);
    let didStart = false;
    try {
      if (!await canStart()) return;
      for (let pass = 0; pass < 2; pass += 1) {
        const { data, error: startError } = await supabase.rpc('start_practice_attempt', {
          p_set_id: setId,
        });
        if (!mountedRef.current) return;
        if (startError) {
          console.error('start_practice_attempt error:', startError);
          const msg = startError.message || '';
          if (msg.includes('active_material_in_progress')) {
            if (await canStart()) setError('Există deja o altă rezolvare în desfășurare. Reîncearcă.');
          } else if (msg.includes('Abonament necesar')) {
            setError('Ai nevoie de un abonament activ pentru a accesa acest set.');
          } else if (msg.includes('Limita de 3 încercări')) {
            setError('Ai folosit toate cele 3 încercări pentru acest set.');
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

        const att = data[0] as {
          out_id: string;
          out_set_id: string;
          out_answers: Record<string, string>;
          out_started_at: string;
          out_submitted_at: string | null;
          out_is_new: boolean;
        };
        if (att.out_set_id !== setId) {
          setError('Încercarea primită nu aparține acestui set. Reîncarcă pagina și încearcă din nou.');
          return;
        }
        if (att.out_submitted_at) {
          clearPracticeDeadline(att.out_id);
          setError('S-a primit o încercare deja încheiată. Reîncarcă pagina și încearcă din nou.');
          return;
        }

        const savedDeadline = att.out_is_new ? null : readPracticeDeadline(att.out_id);
        const savedRemaining = att.out_is_new ? null : readPracticeRemaining(att.out_id);
        if (savedRemaining === null && savedDeadline !== null && savedDeadline <= Date.now()) {
          const { error: expireError } = await supabase.rpc('submit_practice_attempt', {
            p_set_id: setId,
            p_answers: att.out_answers || {},
          });
          if (!mountedRef.current) return;
          if (expireError) {
            console.error('Expired practice attempt could not be finalized:', expireError);
            setError('Încercarea anterioară a expirat, dar nu a putut fi încheiată. Încearcă din nou.');
            return;
          }
          clearPracticeDeadline(att.out_id);
          continue;
        }

        const nextDeadline = savedRemaining !== null
          ? Date.now() + savedRemaining * 1000
          : savedDeadline ?? (selectedMinutes === null ? null : Date.now() + selectedMinutes * 60_000);
        const initialTimeLeft = savedRemaining ?? (nextDeadline === null ? null : Math.max(0, Math.ceil((nextDeadline - Date.now()) / 1000)));
        const savedDuration = att.out_is_new ? null : readPracticeTimerDuration(att.out_id);
        const startedAt = Date.parse(att.out_started_at);
        const inferredDuration = savedDeadline !== null && Number.isFinite(startedAt)
          ? Math.ceil((savedDeadline - startedAt) / 1000)
          : null;
        const validInferredDuration = inferredDuration !== null && initialTimeLeft !== null
          && inferredDuration >= initialTimeLeft
          ? inferredDuration : null;
        const nextTimerDuration = nextDeadline === null ? null : (
          savedDeadline === null && savedRemaining === null
            ? selectedMinutes! * 60
            : savedDuration ?? validInferredDuration ?? initialTimeLeft
        );
        if (nextDeadline !== null && nextTimerDuration !== null) {
          savePracticeDeadline(att.out_id, nextDeadline, nextTimerDuration);
          if (initialTimeLeft !== null) savePracticeRemaining(att.out_id, initialTimeLeft);
        }
        attemptIdRef.current = att.out_id;
        setMarkAttemptId(att.out_id);
        answersRef.current = att.out_answers || {};
        setAnswers(answersRef.current);
        submittedRef.current = false;
        autoSubmitTriggeredRef.current = false;
        setDeadline(nextDeadline);
        setTimeLeft(initialTimeLeft);
        deadlineRef.current = nextDeadline;
        timeLeftRef.current = initialTimeLeft;
        timerPausedRef.current = document.hidden;
        setTimerDuration(nextTimerDuration);
        didStart = true;
        setStarted(true);
        return;
      }
      setError('Încercarea anterioară a expirat. Reîncearcă pornirea setului.');
    } catch (err) {
      console.error('Unexpected practice start error:', err);
      if (mountedRef.current) setError('Nu s-a putut porni setul. Încearcă din nou.');
    } finally {
      startingRef.current = false;
      if (mountedRef.current && !didStart) setLoading(false);
    }
  }, [setId, minutesInput, canStart, resume]);

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

  useEffect(() => {
    if (!started || questions.length === 0) return;
    let frame = 0;
    const updateActiveQuestion = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        let current = 0;
        questions.forEach((question, index) => {
          const element = document.getElementById(`practice-question-${question.out_id}`);
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
    if (!mountedRef.current || submittedRef.current) return;
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

    if (!mountedRef.current) return;

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
      if (result.out_id !== attemptIdRef.current) {
        setError('Răspunsul primit nu corespunde încercării curente. Verifică istoricul înainte de a relua.');
        submittedRef.current = false;
        setSubmitting(false);
        return;
      }
      if (attemptIdRef.current) clearPracticeDeadline(attemptIdRef.current);
      setSubmitting(false);
      onComplete(result.out_id);
    } else {
      setError('Nu am primit confirmarea trimiterii. Verifică istoricul înainte de a relua.');
      submittedRef.current = false;
      setSubmitting(false);
    }
  }, [setId, onComplete]);

  const pausePracticeTimer = useCallback(() => {
    if (timerPausedRef.current || deadlineRef.current === null) return;
    const remaining = Math.max(0, Math.min(
      timeLeftRef.current ?? Infinity,
      Math.ceil((deadlineRef.current - Date.now()) / 1000)
    ));
    timerPausedRef.current = true;
    timeLeftRef.current = remaining;
    setTimeLeft(remaining);
    if (attemptIdRef.current) savePracticeRemaining(attemptIdRef.current, remaining);
  }, []);

  const resumePracticeTimer = useCallback(() => {
    if (!timerPausedRef.current || timeLeftRef.current === null) return;
    const nextDeadline = Date.now() + timeLeftRef.current * 1000;
    timerPausedRef.current = false;
    deadlineRef.current = nextDeadline;
    setDeadline(nextDeadline);
    if (attemptIdRef.current) {
      savePracticeDeadline(attemptIdRef.current, nextDeadline, timerDuration ?? timeLeftRef.current);
    }
  }, [timerDuration]);

  useEffect(() => {
    if (!started || deadline === null) return;
    const tick = () => {
      if (timerPausedRef.current || document.hidden) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);
      if (attemptIdRef.current) savePracticeRemaining(attemptIdRef.current, remaining);
      if (remaining === 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        void submitAttempt();
      }
    };
    const handleVisibility = () => {
      if (document.hidden) pausePracticeTimer();
      else resumePracticeTimer();
    };
    if (document.hidden) pausePracticeTimer();
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [started, deadline, submitAttempt, pausePracticeTimer, resumePracticeTimer]);

  const handleAnswer = (questionId: string, letter: string) => {
    const newAnswers = { ...answersRef.current, [questionId]: letter };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProgress(newAnswers);
    }, 800);
  };

  const leaveAttempt = async (navigate: () => void) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pausePracticeTimer();
    if (started && attemptIdRef.current && !submittedRef.current && Object.keys(answersRef.current).length > 0) {
      try {
        const { error: saveError } = await supabase.rpc('save_practice_progress', {
          p_attempt_id: attemptIdRef.current,
          p_answers: answersRef.current,
        });
        if (saveError) throw saveError;
      } catch (saveError) {
        console.error('Save before exit error:', saveError);
        setSaveState('error');
        if (!document.hidden) resumePracticeTimer();
        return;
      }
    }
    navigate();
  };

  // Save before unload
  useEffect(() => {
    if (!started) return;
    const handleBeforeUnload = () => {
      pausePracticeTimer();
      if (session?.access_token && attemptIdRef.current && !submittedRef.current && Object.keys(answersRef.current).length > 0) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        try {
          fetch(`${supabaseUrl}/rest/v1/rpc/save_practice_progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${session.access_token}`,
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
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (!mountedRef.current && !timerPausedRef.current && !submittedRef.current) handleBeforeUnload();
    };
  }, [started, session?.access_token, pausePracticeTimer]);

  if (loading) return <Loading message="Se încarcă setul de grile..." />;

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <AlertTriangle size={32} className="mx-auto mb-4 text-red-500" />
          <p className="text-stone-700 font-medium mb-2">A apărut o eroare</p>
          <p className="text-sm text-stone-500 mb-6">{error}</p>
          <button onClick={() => void leaveAttempt(onExit)} className="btn-secondary">
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
              <Logo showText linked={false} />
            </div>
            <button onClick={() => void leaveAttempt(onHome)} className="simulation-intro__home" type="button" aria-label="Acasă">
              <img src="/Home.png" alt="" width={22} height={22} /><span>Acasă</span>
            </button>
          </div>
        </header>
        <main className="simulation-intro__main">
          <section className="simulation-intro__editorial" aria-labelledby="practice-intro-title">
            <p className="simulation-intro__eyebrow">ANTRENAMENT PE CAPITOLE</p>
            <h1 id="practice-intro-title">Înainte să începi</h1>
            <p className="simulation-intro__lead">Rezervă-ți timpul și intră în ritmul de examen.</p>
            <div className="simulation-intro__rule" />
            <h2>De știut înainte de start</h2>
            <ol className="simulation-intro__steps">
              <li><span className="simulation-intro__step-number">1</span><span>{resume ? <>Reiei rezolvarea cu <strong>răspunsurile și timpul păstrate.</strong></> : <>Poți introduce timpul-limită pentru acest set.<strong className="simulation-intro__step-note">( Câmp gol = Fără limită )</strong></>}</span></li>
              <li><span className="simulation-intro__step-number">2</span><span><strong>Revino la set când dorești.</strong> Cronometrul pornește din nou doar când reiei rezolvarea.</span></li>
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
                {resume ? (
                  <p className="simulation-intro__remaining">{introRemaining === null ? 'Fără limită de timp' : <><strong>{Math.ceil(introRemaining / 60)}</strong> {Math.ceil(introRemaining / 60) === 1 ? 'minut rămas' : 'minute rămase'}</>}</p>
                ) : <label className="simulation-intro__time-field">
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
                </label>}
              </div>
              {minutesError && <p id="practice-time-error" className="simulation-intro__time-error" role="alert">{minutesError}</p>}
              <div className="simulation-intro__actions">
                <button onClick={startAttempt} className="simulation-intro__start" type="button" disabled={startingRef.current}>{resume ? 'Continuă rezolvarea' : 'Începe setul'}</button>
                <button onClick={() => void leaveAttempt(onExit)} className="simulation-intro__later" type="button">Nu acum</button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const activeQuestionId = questions[activeQuestion]?.out_id;
  const ringSeconds = timeLeft === null ? 0 : timeLeft >= 3600 || !showSeconds ? Math.ceil(timeLeft / 60) * 60 : timeLeft;
  const ringProgress = Math.min(100, Math.max(0, 100 * ringSeconds / (timerDuration || 1)));

  return (
    <div className={`practice-exam${comfortTheme === 'light' ? '' : ` practice-exam--${comfortTheme}`}`}>
      <header className="practice-exam__header">
        <div className="practice-exam__header-inner">
          <div className="practice-exam__brand">
            <Logo showText linked={false} />
          </div>
          <nav className="practice-exam__breadcrumb" aria-label="Locația curentă">
            <button type="button" onClick={() => void leaveAttempt(onExit)}>Antrenament pe capitole</button>
            <span aria-hidden="true">/</span>
            <strong>{introMeta ? practiceSetName(introMeta.lessonTitle, introMeta.position) : 'Set de grile'}</strong>
          </nav>
          <ExamHeaderTools comfortTheme={comfortTheme} onComfortChange={setComfortTheme} onHome={() => void leaveAttempt(onHome)} />
        </div>
      </header>

      <div className="practice-exam__layout">
        <QuestionRail questionIds={questions.map((question) => question.out_id)} answers={answers} markedIds={markedIds} activeIndex={activeQuestion} questionIdPrefix="practice-question-" />

        <main className="practice-exam__questions" aria-label="Grilele setului">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.out_id}
              question={q}
              index={idx}
              selectedAnswer={answers[q.out_id]}
              onSelect={(letter) => handleAnswer(q.out_id, letter)}
            />
          ))}

          {questions.length === 0 && <p className="practice-exam__empty">Nu există întrebări în acest set.</p>}

          {questions.length > 0 && (
            <footer className="practice-exam__footer">
              <span>Ai ajuns la finalul setului.</span>
              <button type="button" onClick={() => void submitAttempt()} disabled={submitting}>
                {submitting ? 'Se trimite…' : 'Trimite răspunsurile'}
              </button>
            </footer>
          )}
        </main>

        <aside className={`practice-exam__progress${timeLeft === null ? ' practice-exam__progress--untimed' : ''}`} aria-label="Progresul setului">
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
            {timeLeft !== null && (
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
                  aria-label={`Timp rămas: ${formatPracticeTime(timeLeft, showSeconds)}${timeLeft < 3600 ? `. ${showSeconds ? 'Ascunde secundele' : 'Afișează secundele'}` : ''}`}
                  onClick={() => setShowSeconds((current) => !current)}
                >{formatPracticeTime(timeLeft, showSeconds)}</button>
              </div>
            )}
            <div className="practice-exam__side-actions">
              <button className="practice-exam__side-action" type="button" disabled={!activeQuestionId} aria-pressed={activeQuestionId ? markedIds.has(activeQuestionId) : false} onClick={() => { if (activeQuestionId) toggleMark(activeQuestionId); }}>
                <Bookmark size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{activeQuestionId && markedIds.has(activeQuestionId) ? 'Demarchează grila' : 'Marchează grila'}</span>
              </button>
            </div>
            <button className="practice-exam__submit" type="button" onClick={() => void submitAttempt()} disabled={submitting || questions.length === 0}>
              <span>{submitting ? 'Se trimite…' : 'Trimite răspunsurile'}</span>
              <Send size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </aside>
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
    <section className="practice-exam__question" id={`practice-question-${question.out_id}`} aria-labelledby={`practice-question-title-${question.out_id}`}>
      <p className="practice-exam__eyebrow">Întrebarea {index + 1} <span aria-hidden="true">/</span> {isCG ? 'Complement grupat' : 'Complement simplu'}</p>
      <h2 id={`practice-question-title-${question.out_id}`}>{question.out_question_text}</h2>

      {isCG && (
        <div className="practice-exam__statements">
          {[1, 2, 3, 4].map((n) => {
            const text = question[`out_statement_${n}` as keyof PracticeQuestionRPC] as string;
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
            : (question[`out_option_${letter.toLowerCase()}` as keyof PracticeQuestionRPC] as string);

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
