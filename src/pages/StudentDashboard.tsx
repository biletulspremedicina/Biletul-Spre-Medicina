import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Archive,
  Bell,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  GraduationCap,
  Home,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trophy,
  X,
  FileText,
  ChartNoAxesCombined,
} from 'lucide-react';
import { supabase, type Attempt, type PracticeAttempt, type PracticeLessonRPC, type Simulation, type Subscription } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Loading from '@/components/Loading';

type IncomingTab = 'all' | 'practice' | 'umfcd' | 'dashboard';
type PageId = 'home' | 'all' | 'practice' | 'umfcd' | 'review';

type Props = {
  onStartSimulation: (simulationId: string) => void;
  onViewResults: (simulationId: string, attemptId?: string) => void;
  onOpenPracticeLesson: (lessonId: string, lessonTitle: string) => void;
  initialTab?: IncomingTab;
};

type SimWithStatus = Simulation & {
  attempts: Attempt[];
  hasSubmitted: boolean;
  hasInProgress: boolean;
  questionCount: number;
};

type PracticeSetRow = { id: string; lesson_id: string };
type Stat = {
  label: string;
  value: string;
  note: string;
  detail: string;
  icon: ReactNode;
  imageSrc: string;
  tone: 'mint' | 'amber';
};

// Completează doar adresele dintre ghilimele. Până atunci rămân pictogramele actuale.
const STAT_IMAGE_SOURCES = [
  '/1.png', // Aici vine sursa imaginea 1 – Rata răspunsurilor corecte
  '/2.png', // Aici vine sursa imaginea 2 – Cel mai bun rezultat la o simulare
  '/3.png', // Aici vine sursa imaginea 3 – Rezultatul ultimei simulări
  '/4.png', // Aici vine sursa imaginea 4 – Media rezultatelor la simulări
  '/5.png', // Aici vine sursa imaginea 5 – Seria actuală de zile active
  '/6.png', // Aici vine sursa imaginea 6 – Timp mediu pe întrebare
  '/7.png', // Aici vine sursa imaginea 7 – Simulări terminate în timpul alocat
  '/8.png', // Aici vine sursa imaginea 8 – Capitole începute
];

const UMFCD_IMAGE_SRC = '/UMFCD.png'; // Imaginea pentru Examene UMFCD

const serif = { fontFamily: 'Georgia, Cambria, "Times New Roman", serif' };
const validAnswer = (value: unknown) =>
  typeof value === 'string' && /^[A-E]$/.test(value.toUpperCase());
const answerCount = (answers: Record<string, string> | null | undefined) =>
  Object.values(answers || {}).filter(validAnswer).length;
const toPercent = (score: number, maximum: number) =>
  maximum > 0 ? Math.round((score / maximum) * 100) : null;
const dateKey = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const hourInBucharest = (date: Date) =>
  Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date));
const hash = (text: string) => {
  let value = 2166136261;
  for (const character of text) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  }
  return value >>> 0;
};

// Valoare demonstrativă pentru machetă. De înlocuit cu o interogare reală.
function demoCommunityPercent(now: Date) {
  const today = dateKey(now);
  const [year, month, day] = today.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  // Benzile alternative garantează că ținta nu se repetă în două zile consecutive.
  const target = 60 + (hash(today) % 13) + (dayNumber % 2 ? 13 : 0);
  const hour = hourInBucharest(now);
  if (hour === 0) return 0;
  const weights = Array.from({ length: 23 }, (_, index) => 1 + (hash(`${today}-${index}`) % 5));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const elapsedWeight = weights.slice(0, hour).reduce((sum, weight) => sum + weight, 0);
  return Math.min(target, hour + Math.floor(((target - 23) * elapsedWeight) / totalWeight));
}

function nextMaterialTime(now: Date) {
  const target = new Date(now);
  target.setHours(20, 0, 0, 0);
  if (now.getTime() >= target.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

function getGreeting() {
  const hour = hourInBucharest(new Date());
  if (hour < 11) return 'Bună dimineața,';
  if (hour < 18) return 'Bună ziua,';
  return 'Bună seara,';
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

function initialPage(tab: IncomingTab): PageId {
  if (tab === 'practice' || tab === 'umfcd') return tab;
  return 'home';
}

export default function StudentDashboard({
  onStartSimulation,
  onViewResults,
  onOpenPracticeLesson,
  initialTab = 'all',
}: Props) {
  const { profile, signOut } = useAuth();
  const [page, setPage] = useState<PageId>(() => initialPage(initialTab));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedStat, setSelectedStat] = useState<Stat | null>(null);
  const [simulations, setSimulations] = useState<SimWithStatus[]>([]);
  const [practiceLessons, setPracticeLessons] = useState<PracticeLessonRPC[]>([]);
  const [practiceAttempts, setPracticeAttempts] = useState<PracticeAttempt[]>([]);
  const [practiceSets, setPracticeSets] = useState<PracticeSetRow[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subPrice, setSubPrice] = useState(30);
  const [buyingSub, setBuyingSub] = useState(false);
  const [subMessage, setSubMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [communityPercent, setCommunityPercent] = useState(() => demoCommunityPercent(new Date()));

  useEffect(() => {
    setPage(initialPage(initialTab));
  }, [initialTab]);

  useEffect(() => {
    const update = () => setCommunityPercent(demoCommunityPercent(new Date()));
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [simRes, subRes, attemptRes, practiceAttemptRes, practiceSetRes, lessonRes, settingsRes] =
        await Promise.all([
          supabase.from('simulations').select('*').order('created_at', { ascending: false }),
          supabase.from('subscriptions').select('*').eq('user_id', profile.id).order('end_at', { ascending: false }),
          supabase.from('attempts').select('*').eq('user_id', profile.id),
          supabase.from('practice_attempts').select('*').eq('user_id', profile.id),
          supabase.from('practice_sets').select('id, lesson_id').eq('is_active', true),
          supabase.rpc('get_practice_lessons'),
          supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
        ]);

      if (simRes.error || subRes.error || attemptRes.error) {
        setLoadError('Unele date nu au putut fi încărcate. Reîncearcă puțin mai târziu.');
      }
      if (settingsRes.data) setSubPrice(Number(settingsRes.data.subscription_price_ron));
      const now = new Date();
      const activeSub = (subRes.data || []).find(
        (item) => item.status === 'active' && new Date(item.end_at) > now
      ) as Subscription | undefined;
      setSubscription(activeSub || null);

      const sims = (simRes.data || []) as Simulation[];
      const attempts = (attemptRes.data || []) as Attempt[];
      const counts: Record<string, number> = {};
      const countResults = await Promise.all(
        sims.map((sim) => supabase.rpc('get_exam_question_count', { p_simulation_id: sim.id }))
      );
      countResults.forEach((result) => {
        const row = result.data?.[0] as { sim_id: string; question_count: number } | undefined;
        if (row) counts[row.sim_id] = Number(row.question_count) || 0;
      });
      setSimulations(sims.map((sim) => {
        const ownAttempts = attempts.filter((attempt) => attempt.simulation_id === sim.id);
        return {
          ...sim,
          attempts: ownAttempts,
          hasSubmitted: ownAttempts.some((attempt) => !!attempt.submitted_at),
          hasInProgress: ownAttempts.some((attempt) => !attempt.submitted_at),
          questionCount: counts[sim.id] || 0,
        };
      }));
      setPracticeAttempts((practiceAttemptRes.data || []) as PracticeAttempt[]);
      setPracticeSets((practiceSetRes.data || []) as PracticeSetRow[]);
      setPracticeLessons((lessonRes.data || []) as PracticeLessonRPC[]);
    } catch (error) {
      console.error('Student dashboard load error:', error);
      setLoadError('Nu am putut încărca pagina. Reîncearcă.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleBuySubscription = async () => {
    setBuyingSub(true);
    setSubMessage(null);
    try {
      const { error } = await supabase.rpc('activate_test_subscription');
      if (error) throw error;
      setSubMessage('Abonamentul a fost activat cu succes.');
      await loadDashboard();
    } catch (error) {
      console.error('Subscription activation error:', error);
      setSubMessage('Nu s-a putut activa abonamentul. Încearcă din nou.');
    } finally {
      setBuyingSub(false);
    }
  };

  const goTo = (destination: PageId) => {
    setPage(destination);
    setMobileMenuOpen(false);
    setSelectedStat(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSupport = () => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Asistență"]')?.click();
    setMobileMenuOpen(false);
  };

  if (loading) return <Loading message="Se încarcă pagina ta..." />;

  const hasActiveSub = !!subscription;
  const isEvening = hourInBucharest(new Date()) >= 18;
  const allAttempts = simulations.flatMap((sim) => sim.attempts);
  const submittedSimAttempts = allAttempts.filter((attempt) => !!attempt.submitted_at);
  const submittedPracticeAttempts = practiceAttempts.filter((attempt) => !!attempt.submitted_at);
  const allAnsweredIds = new Set<string>();
  [...allAttempts, ...practiceAttempts].forEach((attempt) => {
    Object.entries(attempt.answers || {}).forEach(([id, answer]) => {
      if (validAnswer(answer)) allAnsweredIds.add(id);
    });
  });
  const totalAvailableQuestions =
    simulations.reduce((sum, sim) => sum + sim.questionCount, 0) +
    practiceLessons.reduce((sum, lesson) => sum + Number(lesson.out_question_count || 0), 0);
  const questionsCovered = Math.min(allAnsweredIds.size, totalAvailableQuestions);
  const progressPercent = totalAvailableQuestions > 0
    ? Math.round((questionsCovered / totalAvailableQuestions) * 100)
    : 0;

  const gradedAttempts = [...submittedSimAttempts, ...submittedPracticeAttempts];
  const gradedAnswers = gradedAttempts.reduce((sum, attempt) => sum + answerCount(attempt.answers), 0);
  const correctAnswers = gradedAttempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0);
  const accuracy = gradedAnswers > 0 ? toPercent(correctAnswers, gradedAnswers) : null;
  const simulationResults = submittedSimAttempts
    .filter((attempt) => Number(attempt.max_score) > 0)
    .map((attempt) => ({
      percent: toPercent(Number(attempt.score), Number(attempt.max_score)) || 0,
      submittedAt: attempt.submitted_at || '',
    }));
  const bestResult = simulationResults.length
    ? Math.max(...simulationResults.map((result) => result.percent)) : null;
  const latestResult = [...simulationResults].sort((a, b) =>
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]?.percent ?? null;
  const averageResult = simulationResults.length
    ? Math.round(simulationResults.reduce((sum, result) => sum + result.percent, 0) / simulationResults.length)
    : null;

  const activeDays = new Set<string>();
  [...allAttempts, ...practiceAttempts].forEach((attempt) => {
    if (answerCount(attempt.answers) === 0) return;
    const stamp = new Date(attempt.submitted_at || attempt.started_at);
    if (Number.isNaN(stamp.getTime())) return;
    activeDays.add(dateKey(stamp));
  });
  const today = new Date();
  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(new Date(today.getTime() - 86_400_000));
  let streak = 0;
  if (activeDays.has(todayKey) || activeDays.has(yesterdayKey)) {
    const cursor = new Date(today);
    if (!activeDays.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(dateKey(cursor)) && streak < 3650) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const timedSimAttempts = submittedSimAttempts.filter(
    (attempt) => answerCount(attempt.answers) > 0 &&
      Number.isFinite(new Date(attempt.submitted_at!).getTime() - new Date(attempt.started_at).getTime())
  );
  const timePerQuestion = timedSimAttempts.length
    ? timedSimAttempts.reduce((sum, attempt) => {
        const elapsed = Math.max(0, (new Date(attempt.submitted_at!).getTime() -
          new Date(attempt.started_at).getTime()) / 1000);
        const sim = simulations.find((item) => item.id === attempt.simulation_id);
        const bounded = sim ? Math.min(elapsed, sim.duration_minutes * 60) : elapsed;
        return sum + bounded;
      }, 0) / timedSimAttempts.reduce((sum, attempt) => sum + answerCount(attempt.answers), 0)
    : 0;
  const finishedInTime = submittedSimAttempts.filter((attempt) => {
    const sim = simulations.find((item) => item.id === attempt.simulation_id);
    if (!sim || attempt.expired) return false;
    const elapsed = new Date(attempt.submitted_at!).getTime() - new Date(attempt.started_at).getTime();
    return elapsed >= 0 && elapsed <= sim.duration_minutes * 60_000;
  }).length;
  const setToLesson = new Map(practiceSets.map((set) => [set.id, set.lesson_id]));
  const startedLessons = new Set(practiceAttempts
    .filter((attempt) => answerCount(attempt.answers) > 0)
    .map((attempt) => setToLesson.get(attempt.set_id))
    .filter((id): id is string => !!id));
  const finishedGridsByDay = new Map<string, number>();
  gradedAttempts.forEach((attempt) => {
    if (!attempt.submitted_at) return;
    const key = dateKey(new Date(attempt.submitted_at));
    finishedGridsByDay.set(key, (finishedGridsByDay.get(key) || 0) + answerCount(attempt.answers));
  });
  const weekDayLabels = ['Dum', 'Lu', 'Ma', 'Mi', 'Joi', 'Vi', 'Sâm'];
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const [year, month, day] = todayKey.split('-').map(Number);
    const calendarDay = new Date(Date.UTC(year, month - 1, day - (6 - index), 12));
    const key = calendarDay.toISOString().slice(0, 10);
    return {
      key,
      label: weekDayLabels[calendarDay.getUTCDay()],
      count: finishedGridsByDay.get(key) || 0,
    };
  });

  const stats: Stat[] = [
    {
      label: 'Rata răspunsurilor corecte',
      value: accuracy === null ? '—' : `${accuracy}%`,
      note: 'Din răspunsurile trimise',
      detail: 'Procentul răspunsurilor corecte din întrebările la care ai răspuns în activitățile finalizate.',
      icon: <Target size={26} strokeWidth={2.2} />, imageSrc: STAT_IMAGE_SOURCES[0], tone: 'mint',
    },
    {
      label: 'Cel mai bun rezultat la o simulare',
      value: bestResult === null ? '—' : `${bestResult}%`,
      note: 'Din simulările finalizate',
      detail: 'Cel mai mare procent obținut la o simulare finalizată.',
      icon: <Trophy size={26} strokeWidth={2.1} />, imageSrc: STAT_IMAGE_SOURCES[1], tone: 'amber',
    },
    {
      label: 'Rezultatul ultimei simulări',
      value: latestResult === null ? '—' : `${latestResult}%`,
      note: 'Cea mai recentă simulare',
      detail: 'Procentul obținut la ultima simulare pe care ai finalizat-o.',
      icon: <FileText size={26} strokeWidth={2.1} />, imageSrc: STAT_IMAGE_SOURCES[2], tone: 'mint',
    },
    {
      label: 'Media rezultatelor la simulări',
      value: averageResult === null ? '—' : `${averageResult}%`,
      note: 'Media tuturor simulărilor',
      detail: 'Media aritmetică a procentelor obținute la simulările finalizate.',
      icon: <ChartNoAxesCombined size={26} strokeWidth={2.1} />, imageSrc: STAT_IMAGE_SOURCES[3], tone: 'mint',
    },
    {
      label: 'Seria actuală de zile active',
      value: `${streak} ${streak === 1 ? 'zi' : 'zile'}`,
      note: 'Zile consecutive cu activitate',
      detail: 'Zile consecutive în care ai răspuns la întrebări. Ziua curentă nu rupe seria înainte să începi să lucrezi.',
      icon: <Flame size={26} strokeWidth={2.1} />, imageSrc: STAT_IMAGE_SOURCES[4], tone: 'amber',
    },
    {
      label: 'Timp mediu pe întrebare',
      value: formatSeconds(timePerQuestion),
      note: 'Din simulările finalizate',
      detail: 'Durata simulărilor finalizate, împărțită la numărul întrebărilor la care ai răspuns.',
      icon: <Clock3 size={26} strokeWidth={2.1} />, imageSrc: STAT_IMAGE_SOURCES[5], tone: 'mint',
    },
    {
      label: 'Simulări terminate în timpul alocat',
      value: String(finishedInTime),
      note: 'Din simulările finalizate',
      detail: 'Numărul simulărilor trimise înainte de expirarea duratei alocate.',
      icon: <Check size={26} strokeWidth={2.5} />, imageSrc: STAT_IMAGE_SOURCES[6], tone: 'mint',
    },
    {
      label: 'Capitole începute',
      value: String(startedLessons.size),
      note: 'Ai răspuns la cel puțin o grilă',
      detail: 'Un capitol este început când răspunzi la prima întrebare dintr-un set al său.',
      icon: <BookOpen size={26} strokeWidth={2.1} />, imageSrc: STAT_IMAGE_SOURCES[7], tone: 'mint',
    },
  ];

  const navItems: { id: PageId; label: string; icon: ReactNode }[] = [
    { id: 'home', label: 'Acasă', icon: <Home size={19} /> },
    { id: 'all', label: 'Simulări biologie', icon: <FileText size={19} /> },
    { id: 'practice', label: 'Antrenament pe capitole', icon: <GraduationCap size={20} /> },
    { id: 'umfcd', label: 'Examene UMFCD', icon: <UmfcdIcon size={19} imageSize={28} /> },
    { id: 'review', label: 'Întrebări de revizuit', icon: <Bookmark size={19} /> },
  ];

  const sidebar = (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col bg-[#073e33] px-4 pb-5 pt-8 text-white shadow-[14px_0_35px_rgba(4,43,35,0.08)] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
      mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="mb-9 flex items-center gap-2 px-3">
        <img src="/Logo_final.png" alt="" className="h-11 w-16 shrink-0 object-contain" />
        <div className="text-[13px] font-extrabold uppercase leading-[1.05] tracking-[0.03em]">
          <span className="block">Biletul</span>
          <span className="block">Spre</span>
          <span className="block">Medicină</span>
        </div>
        <button type="button" onClick={() => setMobileMenuOpen(false)}
          className="ml-auto rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Închide meniul">
          <X size={20} />
        </button>
      </div>

      <nav aria-label="Navigare elev" className="space-y-1.5">
        {navItems.map((item) => (
          <button key={item.id} type="button" onClick={() => goTo(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
            className={`flex w-full items-center gap-4 rounded-[11px] px-4 py-3 text-left text-[13px] font-semibold transition-colors ${
              page === item.id
                ? 'bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-[#cde5dc] hover:bg-white/10 hover:text-white'
            }`}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
            <span className="leading-snug">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/20 pt-6">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#215f50] text-sm font-bold text-white">
            {(profile?.full_name || profile?.email || 'E').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">
              {profile?.full_name || profile?.email || 'Elev'}
            </p>
            <p className={`mt-0.5 flex items-center gap-1.5 text-xs font-semibold ${
              hasActiveSub ? 'text-amber-300' : 'text-white/70'
            }`} title={hasActiveSub && subscription
              ? `Valabil până la ${new Date(subscription.end_at).toLocaleDateString('ro-RO')}` : undefined}>
              {hasActiveSub && <Crown size={13} fill="currentColor" />}
              {hasActiveSub ? 'Abonament activ' : 'Fără abonament activ'}
            </p>
          </div>
        </div>
        {!hasActiveSub && (
          <button type="button" onClick={handleBuySubscription} disabled={buyingSub}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-2.5 text-xs font-bold text-[#183d31] hover:bg-amber-200 disabled:opacity-60">
            {buyingSub && <Loader2 size={14} className="animate-spin" />}
            Activează abonamentul · {subPrice} RON
          </button>
        )}
        <button type="button" onClick={openSupport}
          className="mt-6 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-white/90 hover:bg-white/10">
          <MessageCircle size={24} />
          <span className="leading-tight">
            <span className="block text-xs font-semibold">Ai întrebări?</span>
            <span className="text-[11px] text-[#bdd9ce]">Suntem aici pentru tine.</span>
          </span>
        </button>
        <button type="button" onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-xs text-white/65 hover:bg-white/10 hover:text-white">
          <LogOut size={17} /> Deconectare
        </button>
      </div>
    </aside>
  );

  const filteredSims = simulations.filter((sim) => sim.student_section === page);
  const completedInCategory = filteredSims.filter((sim) => sim.hasSubmitted).length;

  return (
    <div className="min-h-screen bg-white font-sans text-[#14283a] lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {mobileMenuOpen && (
        <button type="button" aria-label="Închide meniul" onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-[#071b17]/55 lg:hidden" />
      )}
      {sidebar}

      <div className="min-w-0">
        <header className="relative z-20 flex h-[60px] items-center justify-between border-b border-[#e6eaeb] bg-white px-5 sm:px-7">
          <button type="button" onClick={() => setMobileMenuOpen(true)}
            className="mr-3 rounded-lg p-2 text-[#164d3e] hover:bg-[#e9f5ef] lg:hidden" aria-label="Deschide meniul">
            <Menu size={22} />
          </button>
          <p className="min-w-0 truncate text-[12px] font-medium text-[#536477] sm:text-[13px]">
            <span className="font-semibold text-[#2e896d]">Devino cel mai bun</span>
            <span className="mx-3 text-[#c6d1d2]">—</span>
            Disciplina de azi → Rezultatele de mâine.
          </p>
          <div className="relative ml-auto">
            <button type="button" onClick={() => setNotificationsOpen((open) => !open)}
              aria-label="Notificări" aria-expanded={notificationsOpen}
              className="relative rounded-full p-2 text-[#172b38] hover:bg-[#edf6f2]">
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-[#e2e9e7] bg-white p-4 text-sm shadow-xl">
                <p className="font-bold text-[#133b31]">Notificări</p>
                <p className="mt-2 text-[#687783]">Nu ai notificări noi.</p>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 pb-12 pt-5 sm:px-6 lg:px-6 xl:px-7">
          {(loadError || subMessage) && (
            <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              loadError || subMessage?.startsWith('Nu')
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}>
              {loadError || subMessage}
              {loadError && (
                <button type="button" onClick={() => void loadDashboard()} className="ml-3 font-bold underline">
                  Reîncearcă
                </button>
              )}
            </div>
          )}

          {page === 'home' ? (
            <>
              <div className="grid gap-4 xl:grid-cols-[1.45fr_0.96fr_1.12fr]">
                <section className="relative flex min-h-[356px] flex-col overflow-hidden rounded-[12px] border border-[#cde9df] bg-[linear-gradient(125deg,#fbfffd_0%,#f2fbf8_100%)] p-4 sm:p-5">
                  <div className="pointer-events-none absolute -right-8 top-14 h-52 w-52 rounded-full border-[30px] border-[#ddf5eb]/55" aria-hidden="true" />
                  <div className="relative flex items-start gap-5">
                    {isEvening ? (
                      <Moon size={44} className="mt-1 shrink-0 text-[#6877a9]" strokeWidth={1.7} />
                    ) : (
                      <Sun size={44} className="mt-1 shrink-0 text-[#f0b218]" strokeWidth={1.7} />
                    )}
                    <div className="min-w-0">
                      <p className="text-[22px] font-semibold leading-tight" style={serif}>{getGreeting()}</p>
                      <h1 className="mt-1 flex flex-wrap items-center gap-2 text-[32px] font-bold leading-tight sm:text-[35px]" style={serif}>
                        {profile?.full_name || 'Elev'}
                        {hasActiveSub && <Crown className="text-amber-400" size={24} fill="currentColor" aria-label="Abonament activ" />}
                      </h1>
                      <p className="mt-2 max-w-[410px] text-[15px] leading-relaxed text-[#52667b]">
                        Cu fiecare grilă ești mai aproape de locul tău la medicină!
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-auto grid gap-2 rounded-[34px] border border-[#e6f0ed] bg-white px-4 py-5 shadow-[0_12px_36px_rgba(22,71,57,0.04)] sm:grid-cols-2 sm:gap-0 sm:px-5">
                    <div className="flex items-center gap-3 sm:border-r sm:border-[#dbe9e5] sm:pr-4">
                      <div className="flex h-[86px] w-[86px] shrink-0 items-center justify-center rounded-full p-[7px]"
                        style={{ background: `conic-gradient(#188765 ${communityPercent}%, #e0f2ea 0)` }}>
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[24px] font-extrabold text-[#113d32]">
                          {communityPercent}%
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold leading-snug">Activitatea comunității azi</p>
                        <p className="mt-2 text-[11px] leading-relaxed text-[#607587]">
                          Procent demonstrativ al abonaților activi astăzi
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col justify-center pt-3 text-center sm:pl-5 sm:pt-0">
                      <p className="text-[13px] font-bold leading-snug">Grile lucrate în ultimele 7 zile</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full table-fixed text-center" aria-label="Grile lucrate în fiecare dintre ultimele șapte zile">
                          <thead>
                            <tr className="text-[10px] font-semibold text-[#607587]">
                              {lastSevenDays.map((day) => (
                                <th key={day.key} scope="col" className="px-0.5 pb-1 font-semibold" title={day.key}>
                                  {day.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="text-[12px] font-bold tabular-nums text-[#115c48]">
                              {lastSevenDays.map((day) => (
                                <td key={day.key} className="border-t border-[#e4eeea] px-0.5 pt-1.5">
                                  {day.count}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="flex min-h-[356px] flex-col rounded-[12px] border border-[#dfe6ec] bg-white p-5">
                  <h2 className="text-[27px] font-bold leading-tight" style={serif}>Progres global</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#5d6e85]">
                    Întrebări distincte rezolvate cel puțin o dată din totalul disponibil pe platformă.
                  </p>
                  <div className="my-auto flex justify-center py-3">
                    <div role="img" aria-label={`Progres global: ${progressPercent}%`}
                      className="flex h-[170px] w-[170px] items-center justify-center rounded-full p-[17px]"
                      style={{ background: `conic-gradient(#187c61 ${progressPercent}%, #e8eaf0 0)` }}>
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[36px] font-bold" style={serif}>
                        {progressPercent}%
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[17px] font-bold" style={serif}>
                    {questionsCovered.toLocaleString('ro-RO')} întrebări parcurse
                  </p>
                  <p className="mt-1 text-center text-[11px] text-[#87929f]">
                    {totalAvailableQuestions > 0
                      ? `din ${totalAvailableQuestions.toLocaleString('ro-RO')} disponibile`
                      : 'Întrebările vor apărea după publicare'}
                  </p>
                </section>

                <section className="relative flex min-h-[356px] flex-col overflow-hidden rounded-[12px] bg-[#034638] p-6 text-white">
                  <svg className="pointer-events-none absolute bottom-0 left-0 w-full opacity-20" viewBox="0 0 430 70" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 38 Q92 85 190 48 T430 40 V70 H0Z" fill="#4ba27f" />
                    <path d="M0 58 Q135 5 265 52 T430 32 V70 H0Z" fill="#277d60" />
                  </svg>
                  <div className="relative flex items-start gap-4">
                    <Timer size={34} className="shrink-0 text-[#65dbb7]" strokeWidth={1.7} />
                    <h2 className="pt-1 text-[19px] font-bold leading-snug" style={serif}>
                      Materiale noi pe platformă în:
                    </h2>
                  </div>
                  <CompactCountdown />
                  <div className="relative mt-auto border-t border-white/25 pt-5">
                    <div className="flex items-start gap-4">
                      <BookOpen size={25} className="shrink-0 text-[#70e0b8]" strokeWidth={1.8} />
                      <p className="text-[12px] leading-[1.65] text-[#f1fbf7]">
                        Alătură-te comunității de viitori medici și fii primul care accesează noile simulări și grile explicate.
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mb-4 mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <h2 className="text-[29px] font-bold leading-tight sm:text-[32px]" style={serif}>
                  Statistici și performanță
                </h2>
                <p className="pb-1 text-[12px] text-[#66798d]">
                  O privire de ansamblu asupra parcursului tău.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <StatCard key={stat.label} stat={stat} onClick={() => setSelectedStat(stat)} />
                ))}
              </div>
            </>
          ) : page === 'practice' ? (
            <section>
              <PageHeading icon={<GraduationCap size={27} />} title="Antrenament pe capitole"
                subtitle="Alege un capitol și exersează grilele în ritmul tău." />
              {practiceLessons.length === 0 ? (
                <EmptyState icon={<BookOpen size={36} />} title="Nu există capitole publicate momentan."
                  text="Revino mai târziu pentru materiale noi." />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {practiceLessons.map((lesson) => (
                    <PracticeLessonCard key={lesson.out_id} lesson={lesson}
                      onOpen={() => onOpenPracticeLesson(lesson.out_id, lesson.out_title)} />
                  ))}
                </div>
              )}
            </section>
          ) : page === 'all' || page === 'umfcd' ? (
            <section>
              <PageHeading icon={page === 'all' ? <FileText size={27} /> : <UmfcdIcon size={27} imageSize={38} />}
                title={page === 'all' ? 'Simulări biologie' : 'Examene UMFCD'}
                subtitle={page === 'all'
                  ? 'Testează-ți pregătirea prin simulările disponibile.'
                  : 'Rezolvă subiecte din examenele și simulările UMFCD.'} />
              <div className="mb-6 rounded-2xl border border-[#dcece5] bg-[#f7fcf9] px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-[#153f34]">
                    {completedInCategory} din {filteredSims.length} simulări rezolvate
                  </p>
                  <span className="text-xs text-[#71827b]">{filteredSims.length} disponibile</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dbe9e2]">
                  <div className="h-full rounded-full bg-[#167d5f] transition-[width] duration-500"
                    style={{ width: `${filteredSims.length ? Math.round((completedInCategory / filteredSims.length) * 100) : 0}%` }} />
                </div>
              </div>
              {filteredSims.length === 0 ? (
                <EmptyState icon={<Archive size={36} />} title="Nu există simulări în această categorie."
                  text="Revino mai târziu pentru simulări noi." />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSims.map((sim) => (
                    <ArchiveSimCard key={sim.id} sim={sim} hasActiveSub={hasActiveSub}
                      onStart={() => onStartSimulation(sim.id)}
                      onViewResults={(attemptId) => onViewResults(sim.id, attemptId)}
                      onBuySubscription={handleBuySubscription} buyingSub={buyingSub} />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section>
              <PageHeading icon={<Bookmark size={27} />} title="Întrebări de revizuit"
                subtitle="Întrebările marcate pentru recapitulare vor fi organizate aici." />
              <EmptyState icon={<Bookmark size={36} />} title="Zona de revizuire nu este încă disponibilă."
                text="Legătura cu grilele marcate va fi adăugată când această funcție este publicată." />
            </section>
          )}
        </main>
      </div>

      {selectedStat && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071f19]/45 p-4"
          onMouseDown={() => setSelectedStat(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="stat-dialog-title"
            className="w-full max-w-md rounded-[24px] border border-[#d8e9e0] bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e1f6ed] text-[#0d6a50]">
                <StatVisual stat={selectedStat} />
              </div>
              <button type="button" onClick={() => setSelectedStat(null)} aria-label="Închide detaliile"
                className="rounded-lg p-2 text-[#65788b] hover:bg-[#f2f7f4]">
                <X size={18} />
              </button>
            </div>
            <h2 id="stat-dialog-title" className="mt-5 text-[24px] font-bold" style={serif}>{selectedStat.label}</h2>
            <p className="mt-3 text-[32px] font-bold text-[#084d3a]">{selectedStat.value}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#607485]">{selectedStat.detail}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = Math.max(0, nextMaterialTime(now).getTime() - now.getTime());
  const units = [
    { value: Math.floor(diff / 86_400_000), label: 'ZILE' },
    { value: Math.floor((diff % 86_400_000) / 3_600_000), label: 'ORE' },
    { value: Math.floor((diff % 3_600_000) / 60_000), label: 'MIN' },
    { value: Math.floor((diff % 60_000) / 1000), label: 'SEC' },
  ];
  return (
    <div className="relative my-8 flex items-start justify-between gap-1 sm:gap-2" aria-label="Timp până la materialele noi">
      {units.map((unit, index) => (
        <div key={unit.label} className="flex min-w-0 flex-1 items-start">
          <div className="min-w-0 flex-1 text-center">
            <div className="rounded-[10px] border border-white/10 bg-white/10 px-1 py-3 text-[26px] font-extrabold leading-none tabular-nums text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:text-[30px]">
              {String(unit.value).padStart(2, '0')}
            </div>
            <span className="mt-2 block text-[10px] font-semibold tracking-wide text-white/75">{unit.label}</span>
          </div>
          {index < units.length - 1 && <span className="px-1 pt-3 text-lg text-white/45">:</span>}
        </div>
      ))}
    </div>
  );
}

function StatCard({ stat, onClick }: { stat: Stat; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group flex min-h-[176px] w-full flex-col rounded-[11px] border border-[#e0e7ed] bg-white p-[18px] text-left shadow-[0_3px_13px_rgba(33,55,69,0.025)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b8d9cb] hover:shadow-[0_12px_30px_rgba(24,74,58,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a9b78] motion-reduce:transition-none">
      <div className="flex w-full items-start gap-4">
        <span className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full ${
          stat.tone === 'amber' ? 'bg-[#fff1d9] text-[#e8a212]' : 'bg-[#dff5eb] text-[#0e6b51]'
        }`}><StatVisual stat={stat} /></span>
        <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <span className="min-w-0 pt-2 text-[17px] font-bold leading-[1.22]" style={serif}>{stat.label}</span>
        </span>
      </div>
      <div className="mt-auto flex w-full items-center justify-between gap-2 pl-[74px]">
        <span className="text-[31px] font-extrabold leading-none text-[#14283a]">{stat.value}</span>
        <ChevronRight size={17} className="shrink-0 text-[#183044] transition-transform group-hover:translate-x-0.5" />
      </div>
      <span className="mt-2 block pl-[74px] text-[11px] leading-snug text-[#657b93]">{stat.note}</span>
    </button>
  );
}

function StatVisual({ stat }: { stat: Stat }) {
  return stat.imageSrc ? (
    <img src={stat.imageSrc} alt="" className="h-9 w-9 object-contain" loading="lazy" draggable={false} />
  ) : stat.icon;
}

function UmfcdIcon({ size, imageSize }: { size: number; imageSize: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!UMFCD_IMAGE_SRC || imageFailed) return <Crown size={size} />;
  return (
    <img
      src={UMFCD_IMAGE_SRC}
      alt=""
      width={imageSize}
      height={imageSize}
      className="max-w-none shrink-0 object-contain"
      onError={() => setImageFailed(true)}
      draggable={false}
    />
  );
}

function PageHeading({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-7 flex items-start gap-4 rounded-[18px] border border-[#d8eae1] bg-[#f5fbf8] p-5 sm:p-6">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e0f3e9] text-[#0f6d52]">{icon}</span>
      <div>
        <h1 className="text-[29px] font-bold leading-tight text-[#163c32]" style={serif}>{title}</h1>
        <p className="mt-1 text-sm text-[#617587]">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#cddfd5] bg-white p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#edf7f2] text-[#1a775a]">{icon}</div>
      <h2 className="mt-5 text-lg font-bold text-[#183d32]">{title}</h2>
      <p className="mt-2 text-sm text-[#6c7f8b]">{text}</p>
    </div>
  );
}

function PracticeLessonCard({ lesson, onOpen }: { lesson: PracticeLessonRPC; onOpen: () => void }) {
  return (
    <div className="group flex flex-col rounded-2xl border border-[#dce9e3] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#9fcdb9] hover:shadow-lg motion-reduce:transition-none">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e3f4ea] text-[#176b4f]">
          <BookOpen size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="badge mb-1 bg-[#f1f6f3] text-[#547364]">{lesson.out_subject}</span>
          <h3 className="line-clamp-2 font-display text-base font-semibold text-stone-900">{lesson.out_title}</h3>
        </div>
      </div>
      {lesson.out_description && <p className="mb-3 line-clamp-2 text-sm text-stone-600">{lesson.out_description}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
        <span className="flex items-center gap-1"><Layers size={13} /> {lesson.out_set_count} seturi</span>
        <span className="flex items-center gap-1"><FileText size={13} /> {lesson.out_question_count} grile</span>
      </div>
      <div className="mt-auto border-t border-stone-100 pt-3">
        <button type="button" onClick={onOpen} className="btn-primary w-full">
          Rezolvă grile <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ArchiveSimCard({
  sim, hasActiveSub, onStart, onViewResults, onBuySubscription, buyingSub,
}: {
  sim: SimWithStatus;
  hasActiveSub: boolean;
  onStart: () => void;
  onViewResults: (attemptId?: string) => void;
  onBuySubscription: () => void;
  buyingSub: boolean;
}) {
  const isFree = !sim.requires_subscription;
  const submitted = sim.attempts
    .filter((attempt) => !!attempt.submitted_at)
    .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime());
  const hasSubmitted = submitted.length > 0;
  const latestAttempt = submitted[0];

  return (
    <div className="group flex flex-col rounded-2xl border border-[#dfe8e3] bg-white p-5 shadow-sm transition-all duration-200 hover:border-[#abd2be] hover:shadow-md motion-reduce:transition-none">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <h3 className="line-clamp-2 min-w-0 flex-1 font-display text-base font-semibold leading-snug text-stone-900">
          {sim.title}
        </h3>
        {hasSubmitted ? (
          <span className="badge shrink-0 bg-brand-100 text-brand-700">
            <CheckCircle2 size={12} /> Susținut{isFree ? ` (${submitted.length}x)` : ''}
          </span>
        ) : isFree ? (
          <span className="badge shrink-0 bg-stone-100 text-stone-500">Nesusținut</span>
        ) : hasActiveSub ? (
          <span className="badge shrink-0 bg-amber-100 text-amber-700"><Crown size={12} /> Abonament activ</span>
        ) : (
          <span className="badge shrink-0 bg-stone-100 text-stone-500"><Lock size={12} /> Abonament necesar</span>
        )}
      </div>
      {sim.description && <p className="mb-3 line-clamp-2 text-sm text-stone-600">{sim.description}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500">
        <span className="flex items-center gap-1"><Clock3 size={13} /> {sim.duration_minutes} min</span>
        <span className="flex items-center gap-1"><BookOpen size={13} /> {sim.questionCount} grile</span>
        <span className="flex items-center gap-1">
          {isFree ? <Sparkles size={13} /> : <Crown size={13} />}
          {isFree ? 'Gratuită' : 'Necesită abonament'}
        </span>
        {sim.hasInProgress && (
          <span className="flex items-center gap-1 font-medium text-amber-600">
            <Clock3 size={13} /> Încercare în curs
          </span>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-stone-100 pt-4">
        {isFree && (
          <>
            <button type="button" onClick={onStart} className="btn-primary w-full">
              {sim.hasInProgress ? <><PlayCircle size={16} /> Continuă simularea</>
                : hasSubmitted ? <><RotateCcw size={16} /> Rezolvă din nou</>
                : <><PlayCircle size={16} /> Rezolvă simularea</>}
            </button>
            {hasSubmitted ? (
              <button type="button" onClick={() => onViewResults(latestAttempt?.id)} className="btn-secondary w-full">
                <BookOpen size={16} /> Detalii simulare
              </button>
            ) : (
              <span className="flex items-center justify-center gap-1 text-xs text-stone-400">
                <Lock size={11} /> Detaliile sunt disponibile după prima rezolvare
              </span>
            )}
            <span className="flex items-center justify-center gap-1 text-xs text-stone-400">
              <Sparkles size={11} /> Antrenament nelimitat
            </span>
          </>
        )}
        {!isFree && hasSubmitted && (
          <>
            <button type="button" onClick={() => onViewResults(latestAttempt?.id)} className="btn-secondary w-full">
              <BookOpen size={16} /> Detalii simulare
            </button>
            <span className="text-center text-xs font-medium text-stone-500">Susținut — o singură încercare</span>
          </>
        )}
        {!isFree && hasActiveSub && !hasSubmitted && (
          <button type="button" onClick={onStart} className="btn-primary w-full">
            <PlayCircle size={16} /> {sim.hasInProgress ? 'Continuă simularea' : 'Rezolvă simularea'}
          </button>
        )}
        {!isFree && !hasActiveSub && !hasSubmitted && (
          <>
            <button type="button" onClick={onBuySubscription} disabled={buyingSub} className="btn-accent w-full">
              {buyingSub && <Loader2 size={16} className="animate-spin" />}
              <Crown size={16} /> Cumpără abonament pentru a accesa
            </button>
            <span className="text-center text-xs text-stone-400">Mod test – abonamentul se activează gratuit</span>
          </>
        )}
      </div>
    </div>
  );
}
