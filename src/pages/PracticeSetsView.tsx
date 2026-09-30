import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, PREMIUM_ATTEMPT_LIMIT, type PracticeAttempt, type PracticeSetRPC, type Subscription } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronLeft, ChevronDown, CalendarClock,
} from 'lucide-react';
import Logo from '@/components/Logo';
import Loading from '@/components/Loading';
import { practiceChapterImageFor } from '@/lib/practiceChapterImages';

type Props = {
  lessonId: string;
  lessonTitle: string;
  focusSetId?: string;
  onStartSet: (setId: string) => void;
  onViewResults: (setId: string, attemptId?: string) => void;
  onBack: () => void;
  onHome: () => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
};

export default function PracticeSetsView({
  lessonId, lessonTitle, focusSetId, onStartSet, onViewResults, onBack, onHome, onBuySubscription, buyingSub,
}: Props) {
  const { profile } = useAuth();
  const [sets, setSets] = useState<PracticeSetRPC[]>([]);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const openHistories = useRef<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data: setsData, error: setsError } = await supabase.rpc('get_practice_sets', {
      p_lesson_id: lessonId,
    });
    if (setsError) console.error('get_practice_sets error:', setsError);
    const lessonSets = (setsData || []) as unknown as PracticeSetRPC[];
    setSets(lessonSets);

    if (lessonSets.length > 0) {
      const { data: attemptData, error: attemptsError } = await supabase
        .from('practice_attempts')
        .select('*')
        .eq('user_id', profile.id)
        .in('set_id', lessonSets.map((set) => set.out_id))
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: true });
      if (attemptsError) console.error('practice_attempts error:', attemptsError);
      setAttempts((attemptData || []) as PracticeAttempt[]);
    } else {
      setAttempts([]);
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

    setLoading(false);
  }, [lessonId, profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading || !focusSetId || !sets.some((set) => set.out_id === focusSetId)) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`practice-set-${focusSetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusSetId, loading, sets]);

  const hasActiveSub = !!subscription;
  const totalQuestions = sets.reduce((total, set) => total + set.out_question_count, 0);

  return (
    <div className="practice-sets-page min-h-screen bg-stone-50">
      <header className="practice-sets-page__topbar sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur-sm">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-3 sm:px-7 lg:px-8">
          <div className="flex origin-left scale-[0.9] items-center gap-1 sm:scale-100 sm:gap-1.5">
            <div className="sm:hidden"><Logo size="sm" /></div>
            <div className="hidden sm:block"><Logo /></div>
            <span className="flex select-none flex-col text-[10px] font-extrabold uppercase leading-[1.08] tracking-wide sm:text-[12px]">
              <span>Biletul</span><span>Spre</span><span className="practice-sets-page__brand-word">Medicină</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="practice-sets-page__nav-button practice-sets-page__nav-button--back" aria-label="Înapoi la capitole">
              <ChevronLeft size={20} aria-hidden="true" /><span>Înapoi</span>
            </button>
            <button type="button" onClick={onHome} className="practice-sets-page__nav-button practice-sets-page__nav-button--home" aria-label="Acasă">
              <img src="/Home.png" alt="" width={22} height={22} /><span>Acasă</span>
            </button>
          </div>
        </div>
      </header>

      <main className="practice-sets-page__content w-full px-3 py-5 sm:px-4 lg:px-5">
        <section className="practice-sets-page__hero" aria-labelledby="practice-lesson-title">
          <img className="practice-sets-page__hero-photo" src={practiceChapterImageFor(lessonTitle, true)} alt="" />
          <div className="practice-sets-page__hero-veil" />
          <div className="practice-sets-page__hero-copy">
            <p>Antrenament pe capitole</p>
            <h1 id="practice-lesson-title">{lessonTitle}</h1>
          </div>
        </section>

        <div className="practice-sets-page__section-heading">
          <h2>Seturi disponibile</h2>
          {!loading && <span>{sets.length} {sets.length === 1 ? 'set' : 'seturi'} · {totalQuestions} {totalQuestions === 1 ? 'grilă' : 'grile'}</span>}
        </div>

        {loading ? (
          <Loading message="Se încarcă seturile..." />
        ) : sets.length === 0 ? (
          <div className="card p-12 text-center text-stone-500">
            <p className="text-lg font-medium">Nu există seturi publicate în această lecție.</p>
          </div>
        ) : (
          <div className="practice-sets-page__grid">
            {sets.map((set, index) => (
              <PracticeSetCard
                key={set.out_id}
                set={set}
                index={index}
                attempts={attempts.filter((attempt) => attempt.set_id === set.out_id)}
                initialHistoryOpen={openHistories.current[set.out_id] ?? false}
                onHistoryOpenChange={(open) => { openHistories.current[set.out_id] = open; }}
                focused={set.out_id === focusSetId}
                hasActiveSub={hasActiveSub}
                onStart={() => onStartSet(set.out_id)}
                onViewResults={(attemptId) => onViewResults(set.out_id, attemptId)}
                onBuySubscription={onBuySubscription}
                buyingSub={buyingSub}
                onReleaseReached={() => void load()}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PracticeSetCard({
  set, index, attempts, initialHistoryOpen, onHistoryOpenChange, focused, hasActiveSub, onStart, onViewResults, onBuySubscription, buyingSub, onReleaseReached,
}: {
  set: PracticeSetRPC;
  index: number;
  attempts: PracticeAttempt[];
  initialHistoryOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  focused: boolean;
  hasActiveSub: boolean;
  onStart: () => void;
  onViewResults: (attemptId?: string) => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
  onReleaseReached: () => void;
}) {
  const isPremium = set.out_requires_subscription;
  const isLocked = isPremium && !hasActiveSub;
  const hasAttempts = set.out_attempt_count > 0;
  const limitReached = isPremium && set.out_attempt_count >= PREMIUM_ATTEMPT_LIMIT;
  const isScheduled = !!set.out_available_at && new Date(set.out_available_at).getTime() > Date.now();
  const latestAttempt = attempts[attempts.length - 1];
  const historySlotCount = isPremium
    ? Math.max(PREMIUM_ATTEMPT_LIMIT, attempts.length)
    : Math.max(3, attempts.length + 1);
  const [historyOpen, setHistoryOpen] = useState(initialHistoryOpen);
  const historyRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const history = historyRef.current;
    if (!historyOpen || !history || historySlotCount <= 3) return;
    const frame = requestAnimationFrame(() => {
      history.scrollLeft = history.scrollWidth - history.clientWidth;
    });
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || history.scrollWidth <= history.clientWidth) return;
      const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const next = Math.max(0, Math.min(history.scrollWidth - history.clientWidth, history.scrollLeft + movement));
      if (next === history.scrollLeft) return;
      event.preventDefault();
      history.scrollLeft = next;
    };
    history.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      history.removeEventListener('wheel', handleWheel);
    };
  }, [historyOpen, historySlotCount]);

  const toggleHistory = () => {
    const nextOpen = !historyOpen;
    onHistoryOpenChange(nextOpen);
    setHistoryOpen(nextOpen);
  };

  return (
    <article id={`practice-set-${set.out_id}`}
      className={`simulation-library__card simulation-library__card--biology practice-set-card ${focused ? 'ring-2 ring-rose-700 ring-offset-2' : ''}`}
      aria-label={`${set.out_title}, ${set.out_question_count} grile`}>
      <div className="simulation-library__biology-heading">
        <h3>Set</h3>
        <span className="simulation-library__biology-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="simulation-library__biology-meta">
        <span><strong>{set.out_question_count}</strong> {set.out_question_count === 1 ? 'grilă' : 'grile'}</span>
        <span aria-hidden="true">·</span>
        <span className={isPremium ? 'simulation-library__biology-access--premium' : 'simulation-library__biology-access--free'}>
          {isPremium ? 'Acces cu abonament' : 'Fără abonament'}
        </span>
      </div>

      <div className="simulation-library__biology-history">
        <h4>
          <button type="button" className="simulation-library__biology-history-toggle"
            onClick={toggleHistory} aria-expanded={historyOpen} aria-controls={`practice-history-${set.out_id}`}>
            <span>Istoric rezolvări</span><ChevronDown size={21} aria-hidden="true" />
          </button>
        </h4>
        <div id={`practice-history-${set.out_id}`}
          className={`simulation-library__biology-history-panel ${historyOpen ? 'simulation-library__biology-history-panel--open' : ''}`}
          aria-hidden={!historyOpen}>
          <div className="simulation-library__biology-history-slider">
            <ol ref={historyRef} tabIndex={historyOpen && historySlotCount > 3 ? 0 : undefined}
              aria-label={historySlotCount > 3 ? 'Istoricul rezolvărilor; derulează orizontal pentru a le vedea pe toate' : 'Istoricul rezolvărilor'}>
              {Array.from({ length: historySlotCount }, (_, attemptIndex) => {
                const attempt = attempts[attemptIndex];
                const nextIsComplete = !!attempts[attemptIndex + 1];
                return (
                  <li key={attempt?.id ?? `pending-${attemptIndex}`}>
                    {attemptIndex < historySlotCount - 1 && (
                      <span aria-hidden="true" className={`simulation-library__biology-history-link ${attempt && nextIsComplete ? 'simulation-library__biology-history-link--complete' : ''}`} />
                    )}
                    <span aria-hidden="true" className={`simulation-library__biology-history-node ${attempt ? 'simulation-library__biology-history-node--complete' : ''}`} />
                    <span className="simulation-library__biology-history-label">Rezolvarea {attemptIndex + 1}</span>
                    <strong>{attempt ? `${attempt.score}/${attempt.max_score}` : '-'}</strong>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <div className="simulation-library__biology-actions">
        {isScheduled && set.out_available_at ? (
          <div className="simulation-library__biology-countdown">
            <span className="inline-flex items-center gap-1"><CalendarClock size={15} aria-hidden="true" /> Accesibil în</span>
            <ReleaseCountdown target={set.out_available_at} onComplete={onReleaseReached} />
          </div>
        ) : (
          <>
            {hasAttempts && (
              <button type="button" onClick={() => onViewResults(latestAttempt?.id)}
                className="simulation-library__biology-secondary">Vezi detalii</button>
            )}
            {limitReached ? null : isLocked ? (
              <button type="button" onClick={onBuySubscription} disabled={buyingSub}
                className="simulation-library__biology-primary">
                {buyingSub ? 'Se activează…' : 'Activează abonamentul'}
              </button>
            ) : (
              <button type="button" onClick={onStart} className="simulation-library__biology-primary">
                {hasAttempts ? 'Rezolvă din nou' : 'Rezolvă setul'}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function ReleaseCountdown({ target, onComplete }: { target: string; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(target).getTime() - Date.now()));

  useEffect(() => {
    let completed = false;
    const tick = () => {
      const next = Math.max(0, new Date(target).getTime() - Date.now());
      setRemaining(next);
      if (next === 0 && !completed) {
        completed = true;
        onComplete();
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [target, onComplete]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return (
    <span className="mt-1 block font-bold tabular-nums">
      {days > 0 ? `${days}z ` : ''}{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}
