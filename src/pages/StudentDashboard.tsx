import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Target, 
  Trophy, 
  Clock, 
  Zap, 
  Flame, 
  TrendingUp, 
  Award, 
  CheckCircle2, 
  HelpCircle, 
  Calendar, 
  ChevronRight, 
  BarChart2, 
  Activity,
  Sparkles,
  ArrowUpRight,
  Lock,
  Play
} from 'lucide-react';

interface StudentDashboardProps {
  user?: any;
  onNavigate?: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onNavigate }) => {
  // Stări pentru date și metrici
  const [stats, setStats] = useState({
    totalQuestionsAnswered: 24,
    totalPlatformQuestions: 80,
    accuracyRate: 12,
    bestSimulationScore: null,
    lastSimulationScore: null,
    avgSimulationScore: null,
    activeStreak: 3,
    avgTimePerQuestion: '45s'
  });

  const [communityActivityPercentage, setCommunityActivityPercentage] = useState(51);

  // Generare date pentru ultimele 14 zile (Modificarea 3)
  const [last14Days, setLast14Days] = useState<Array<{ dayName: string; dayNum: number; count: number }>>([]);

  useEffect(() => {
    const dayNames = ['Dum', 'Lu', 'Ma', 'Mi', 'Joi', 'Vi', 'Sâm'];
    const days = [];
    const today = new Date();

    // Exemplu date demonstrative pentru 14 zile
    const dummyCounts = [0, 1, 3, 0, 2, 5, 0, 0, 0, 0, 2, 20, 0, 4];

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      days.push({
        dayName: dayNames[d.getDay()],
        dayNum: d.getDate(),
        count: dummyCounts[13 - i] ?? 0
      });
    }
    setLast14Days(days);
  }, []);

  // Timer countdown pentru materiale noi
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 3, minutes: 19, seconds: 58 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const globalProgressPercentage = Math.round((stats.totalQuestionsAnswered / stats.totalPlatformQuestions) * 100);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-8 bg-background text-foreground">
      
      {/* HEADER TOP (Modificarea 4: Eliminat 'Disciplina de azi → Rezultatele de mâine.') */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Devino cel mai bun
          </span>
        </div>
      </div>

      {/* GRID PRINCIPAL TOP (3 Casete) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CASETA STÂNGA: Salut & Activitate Comunitate (Modificările 3 & 5) */}
        <div className="p-6 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">☀️</span>
              <h2 className="text-2xl font-bold">Bună ziua,</h2>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-3">
              {user?.user_metadata?.full_name || 'Daniel Racoviță'} <span className="inline-block text-amber-500">👑</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Consecvența bate volumul. Câteva grile zilnic fac diferența.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            {/* MODIFICAREA 5: Redesenat conform imaginii atașate */}
            <div className="p-4 rounded-xl border bg-background/50 flex flex-col justify-between">
              <h4 className="text-xs font-semibold text-foreground mb-3 leading-snug">
                Activitatea comunității astăzi
              </h4>
              <div className="flex items-center gap-3 my-auto">
                {/* Grafic circular cu procent */}
                <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-muted/20"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500"
                      strokeDasharray={`${communityActivityPercentage}, 100`}
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-foreground">
                    {communityActivityPercentage}%
                  </span>
                </div>

                {/* Text dreapta cerc */}
                <div className="text-xs text-muted-foreground leading-tight space-y-1">
                  <p>din candidați deja au lucrat astăzi pe platformă.</p>
                  <p className="font-semibold text-foreground pt-1">Ce mai aștepți?</p>
                </div>
              </div>
            </div>

            {/* MODIFICAREA 3: Ultimele 14 zile */}
            <div className="p-4 rounded-xl border bg-background/50 flex flex-col justify-between">
              <h4 className="text-xs font-semibold text-foreground mb-3">
                Grile lucrate în ultimele 14 zile
              </h4>
              <div className="grid grid-cols-7 gap-1 text-center">
                {last14Days.map((d, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground">{d.dayName}</span>
                    <span className={`text-xs font-bold mt-1 ${d.count > 0 ? 'text-emerald-600 font-extrabold' : 'text-muted-foreground/60'}`}>
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* CASETA MIJLOC: Progres Global (Modificarea 1) */}
        <div className="p-6 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col items-center justify-between text-center">
          
          {/* MODIFICAREA 1: Aliniat pe mijlocul casetei (text-center) */}
          <div className="text-center w-full">
            <h3 className="text-2xl font-bold text-foreground mb-2">Progres global</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Întrebări distincte rezolvate cel puțin o dată din totalul disponibil pe platformă.
            </p>
          </div>

          {/* Donut Chart Mare */}
          <div className="relative w-40 h-40 my-6 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-muted/20"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-600"
                strokeDasharray={`${globalProgressPercentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-3xl font-extrabold text-foreground">{globalProgressPercentage}%</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {stats.totalQuestionsAnswered} întrebări parcurse
            </p>
            <p className="text-xs text-muted-foreground">
              din {stats.totalPlatformQuestions} disponibile
            </p>
          </div>
        </div>

        {/* CASETA DREAPTA: Materiale noi pe platformă (Modificarea 2: Fără footer-ul verde) */}
        <div className="p-6 rounded-2xl bg-emerald-950 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-emerald-100">
                Materiale noi pe platformă în:
              </h3>
            </div>

            {/* Timper Countdown */}
            <div className="grid grid-cols-4 gap-2 text-center my-4">
              <div className="bg-emerald-900/60 rounded-lg p-2 border border-emerald-800/40">
                <span className="text-2xl font-bold font-mono">
                  {String(timeLeft.days).padStart(2, '0')}
                </span>
                <span className="block text-[10px] text-emerald-300 mt-1 uppercase tracking-wider">ZILE</span>
              </div>
              <div className="bg-emerald-900/60 rounded-lg p-2 border border-emerald-800/40">
                <span className="text-2xl font-bold font-mono">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="block text-[10px] text-emerald-300 mt-1 uppercase tracking-wider">ORE</span>
              </div>
              <div className="bg-emerald-900/60 rounded-lg p-2 border border-emerald-800/40">
                <span className="text-2xl font-bold font-mono">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="block text-[10px] text-emerald-300 mt-1 uppercase tracking-wider">MIN</span>
              </div>
              <div className="bg-emerald-900/60 rounded-lg p-2 border border-emerald-800/40">
                <span className="text-2xl font-bold font-mono">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="block text-[10px] text-emerald-300 mt-1 uppercase tracking-wider">SEC</span>
              </div>
            </div>
          </div>

          {/* MODIFICAREA 2: Subsolul verde cu textul 'Alătură-te comunității...' a fost eliminat complet din acest card */}
        </div>

      </div>

      {/* SECTIUNE STATISTICI ȘI PERFORMANȚĂ (Modificarea 2: Eliminat badge-ul 'O privire de ansamblu...') */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Statistici și performanță</h2>
          {/* MODIFICAREA 2: Eliminat badge-ul 'O privire de ansamblu...' care apărea aici */}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card Stat 1 */}
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col justify-between space-y-4 hover:border-muted-foreground/30 transition-all cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <Target className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                Rata răspunsurilor corecte
              </h4>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold">{stats.accuracyRate}%</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Din răspunsurile trimise</p>
            </div>
          </div>

          {/* Card Stat 2 */}
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col justify-between space-y-4 hover:border-muted-foreground/30 transition-all cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Trophy className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                Cel mai bun rezultat la o simulare
              </h4>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold">{stats.bestSimulationScore ?? '—'}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Din simulările finalizate</p>
            </div>
          </div>

          {/* Card Stat 3 */}
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col justify-between space-y-4 hover:border-muted-foreground/30 transition-all cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                Rezultatul ultimei simulări
              </h4>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold">{stats.lastSimulationScore ?? '—'}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cea mai recentă simulare</p>
            </div>
          </div>

          {/* Card Stat 4 */}
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-sm flex flex-col justify-between space-y-4 hover:border-muted-foreground/30 transition-all cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                Media rezultatelor la simulări
              </h4>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold">{stats.avgSimulationScore ?? '—'}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Media tuturor simulărilor</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default StudentDashboard;