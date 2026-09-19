import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Attempt, PracticeAttempt, PracticeLessonRPC, Simulation } from '@/lib/supabase';
import './StudentPerformance.css';

type Period = '7' | '30' | 'all';
type SimulationWithAttempts = Simulation & { attempts: Attempt[] };
type Props = {
  simulations: SimulationWithAttempts[];
  practiceAttempts: PracticeAttempt[];
  practiceLessons: PracticeLessonRPC[];
  practiceSets: { id: string; lesson_id: string }[];
  onOpenStat: (index: number, value: string, periodLabel: string) => void;
  onViewSimulations: () => void;
  onViewChapters: () => void;
};

const DAY = 86_400_000;
const periodLabels: Record<Period, string> = { '7': 'Ultimele 7 zile', '30': 'Ultimele 30 de zile', all: 'Tot timpul' };
const answerCount = (answers: Record<string, string> | null | undefined) =>
  Object.values(answers || {}).filter((value) => typeof value === 'string' && /^[A-E]$/i.test(value)).length;
const dayKey = (date: Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const localDay = (date: Date) => {
  const [year, month, day] = dayKey(date).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};
const shortDate = (key: string) => new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dateFromKey(key));
const secondsLabel = (seconds: number | null) => {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
};
const percentLabel = (value: number | null) => value === null ? '—' : `${value}%`;

type ChartPoint = { key: string; value: number };

function TrendChart({ points, max, ticks, id, className = '' }: {
  points: ChartPoint[]; max: number; ticks: string[]; id: string; className?: string;
}) {
  if (points.length === 0) return <div className={`performance-empty ${className}`}>Graficul va apărea după primele răspunsuri finalizate.</div>;
  const left = 40, right = 14, top = 18, bottom = 28, width = 700, height = 178;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const positions = points.map((point, index) => ({
    ...point,
    x: left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: top + plotHeight * (1 - Math.min(max, Math.max(0, point.value)) / max),
  }));
  const path = positions.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${path} L ${positions[positions.length - 1].x} ${top + plotHeight} L ${positions[0].x} ${top + plotHeight} Z`;
  const labelIndices = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  return (
    <svg className={`performance-chart ${className}`} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Evoluție: ${points.map((point) => `${shortDate(point.key)} ${Math.round(point.value)}${id === 'accuracy' ? '%' : ' sec'}`).join(', ')}`}>
      <defs>
        <linearGradient id={`performance-area-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".25" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick, index) => {
        const y = top + (index / (ticks.length - 1)) * plotHeight;
        return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} className="performance-chart-grid" />
          <text x={left - 9} y={y + 4} textAnchor="end" className="performance-chart-label">{tick}</text></g>;
      })}
      <path d={area} fill={`url(#performance-area-${id})`} />
      <path d={path} className="performance-chart-line" fill="none" />
      {positions.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="3.5" className="performance-chart-dot">
        <title>{shortDate(point.key)}: {Math.round(point.value)}{id === 'accuracy' ? '%' : ' sec'}</title>
      </circle>)}
      {labelIndices.map((index) => <text key={index} x={positions[index].x} y={height - 5}
        textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
        className="performance-chart-label">{shortDate(positions[index].key)}</text>)}
    </svg>
  );
}

export default function StudentPerformance({ simulations, practiceAttempts, practiceLessons, practiceSets,
  onOpenStat, onViewSimulations, onViewChapters }: Props) {
  const [period, setPeriod] = useState<Period>('30');
  const [todayMs, setTodayMs] = useState(() => localDay(new Date()));
  useEffect(() => {
    const refreshDay = () => setTodayMs(localDay(new Date()));
    const interval = window.setInterval(refreshDay, 60_000);
    document.addEventListener('visibilitychange', refreshDay);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refreshDay); };
  }, []);
  const data = useMemo(() => {
    const startMs = period === 'all' ? -Infinity : todayMs - (Number(period) - 1) * DAY;
    const previousStartMs = period === 'all' ? -Infinity : startMs - Number(period) * DAY;
    const inPeriod = (stamp: string | null) => {
      if (!stamp) return false;
      const time = new Date(stamp);
      return Number.isFinite(time.getTime()) && localDay(time) >= startMs && localDay(time) <= todayMs;
    };
    const inPrevious = (stamp: string | null) => {
      if (period === 'all' || !stamp) return false;
      const time = new Date(stamp);
      return Number.isFinite(time.getTime()) && localDay(time) >= previousStartMs && localDay(time) < startMs;
    };
    const allSim = simulations.flatMap((simulation) => simulation.attempts.map((attempt) => ({ attempt, simulation })));
    const sim = allSim.filter(({ attempt }) => inPeriod(attempt.submitted_at));
    const practice = practiceAttempts.filter((attempt) => inPeriod(attempt.submitted_at));
    const graded = [...sim.map(({ attempt }) => attempt), ...practice];
    const totalAnswers = graded.reduce((sum, attempt) => sum + answerCount(attempt.answers), 0);
    const correct = graded.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0);
    const accuracy = totalAnswers ? Math.round((correct / totalAnswers) * 100) : null;
    const previousGraded = [
      ...allSim.filter(({ attempt }) => inPrevious(attempt.submitted_at)).map(({ attempt }) => attempt),
      ...practiceAttempts.filter((attempt) => inPrevious(attempt.submitted_at)),
    ];
    const previousAnswers = previousGraded.reduce((sum, attempt) => sum + answerCount(attempt.answers), 0);
    const previousAccuracy = previousAnswers ? Math.round(previousGraded.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / previousAnswers * 100) : null;
    const accuracyDelta = accuracy !== null && previousAccuracy !== null ? accuracy - previousAccuracy : null;
    const results = sim.filter(({ attempt }) => attempt.max_score > 0)
      .map(({ attempt }) => ({ value: Math.round((Number(attempt.score || 0) / attempt.max_score) * 100),
        stamp: attempt.submitted_at! }));
    const best = results.length ? Math.max(...results.map((result) => result.value)) : null;
    const latest = [...results].sort((a, b) => new Date(b.stamp).getTime() - new Date(a.stamp).getTime())[0]?.value ?? null;
    const average = results.length ? Math.round(results.reduce((sum, result) => sum + result.value, 0) / results.length) : null;

    const activeDays = new Set<string>();
    [...allSim.map(({ attempt }) => attempt), ...practiceAttempts].forEach((attempt) => {
      if (!answerCount(attempt.answers)) return;
      const stamp = new Date(attempt.submitted_at || attempt.started_at);
      if (Number.isFinite(stamp.getTime()) && localDay(stamp) <= todayMs) activeDays.add(dayKey(stamp));
    });
    let streak = 0;
    let cursor = todayMs;
    if (!activeDays.has(dayKey(new Date(cursor)))) cursor -= DAY;
    while (activeDays.has(dayKey(new Date(cursor))) && streak < 3650) { streak += 1; cursor -= DAY; }
    const heatDays = Array.from({ length: 28 }, (_, index) => {
      const key = dayKey(new Date(todayMs - (27 - index) * DAY));
      return { key, active: activeDays.has(key) };
    });

    const getSimTime = ({ attempt, simulation }: { attempt: Attempt; simulation: Simulation }) => {
      const answers = answerCount(attempt.answers);
      const elapsed = new Date(attempt.submitted_at!).getTime() - new Date(attempt.started_at).getTime();
      if (!answers || !Number.isFinite(elapsed) || elapsed < 0) return [];
      return [{ key: dayKey(new Date(attempt.submitted_at!)), seconds: Math.min(elapsed / 1000, simulation.duration_minutes * 60), answers }];
    };
    const simTimes = sim.flatMap(getSimTime);
    const totalTimedAnswers = simTimes.reduce((sum, item) => sum + item.answers, 0);
    const avgSeconds = totalTimedAnswers ? simTimes.reduce((sum, item) => sum + item.seconds, 0) / totalTimedAnswers : null;
    const previousTimes = allSim.filter(({ attempt }) => inPrevious(attempt.submitted_at)).flatMap(getSimTime);
    const previousTimedAnswers = previousTimes.reduce((sum, item) => sum + item.answers, 0);
    const previousSeconds = previousTimedAnswers ? previousTimes.reduce((sum, item) => sum + item.seconds, 0) / previousTimedAnswers : null;
    const timeDelta = avgSeconds !== null && previousSeconds !== null ? Math.round(avgSeconds - previousSeconds) : null;
    const onTime = sim.filter(({ attempt, simulation }) => {
      const elapsed = new Date(attempt.submitted_at!).getTime() - new Date(attempt.started_at).getTime();
      return !attempt.expired && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= simulation.duration_minutes * 60_000;
    }).length;
    const setToLesson = new Map(practiceSets.map((set) => [set.id, set.lesson_id]));
    const started = new Set(practice.filter((attempt) => answerCount(attempt.answers) > 0)
      .map((attempt) => setToLesson.get(attempt.set_id)).filter((id): id is string => !!id));

    const daily = new Map<string, { correct: number; answers: number }>();
    graded.forEach((attempt) => {
      if (!attempt.submitted_at) return;
      const key = dayKey(new Date(attempt.submitted_at));
      const row = daily.get(key) || { correct: 0, answers: 0 };
      row.correct += Number(attempt.score || 0);
      row.answers += answerCount(attempt.answers);
      daily.set(key, row);
    });
    const accuracyPoints = [...daily.entries()].filter(([, row]) => row.answers > 0).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, row]) => ({ key, value: Math.round((row.correct / row.answers) * 100) }));
    const timeDaily = new Map<string, { seconds: number; answers: number }>();
    simTimes.forEach((item) => {
      const row = timeDaily.get(item.key) || { seconds: 0, answers: 0 };
      row.seconds += item.seconds;
      row.answers += item.answers;
      timeDaily.set(item.key, row);
    });
    const timePoints = [...timeDaily.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([key, row]) => ({ key, value: row.seconds / row.answers }));
    return { accuracy, accuracyDelta, totalAnswers, best, latest, average, streak, heatDays, avgSeconds, timeDelta, onTime,
      totalSim: sim.length, started: started.size, totalLessons: practiceLessons.length, accuracyPoints, timePoints };
  }, [period, todayMs, simulations, practiceAttempts, practiceLessons, practiceSets]);

  const dateText = period === 'all' ? 'Toate datele disponibile'
    : `${shortDate(dayKey(new Date(todayMs - (Number(period) - 1) * DAY)))} – ${shortDate(dayKey(new Date(todayMs)))}`;
  const simRows = [
    { label: 'Cel mai bun rezultat', note: 'Din simulările finalizate', value: data.best, index: 1 },
    { label: 'Ultima simulare', note: 'Cea mai recentă simulare', value: data.latest, index: 2 },
    { label: 'Media simulărilor', note: 'Media în perioada selectată', value: data.average, index: 3 },
  ];
  const timeMax = Math.max(60, ...data.timePoints.map((point) => point.value));
  const timeTickMax = Math.ceil(timeMax / 30) * 30;
  const heatmapFirstDay = new Date(todayMs - 27 * DAY).getUTCDay();
  const heatmapLabels = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'];

  return <section className="performance" aria-labelledby="performance-title">
    <div className="performance-heading">
      <div><p className="performance-eyebrow">PROGRESUL TĂU <span /></p>
        <h2 id="performance-title">Statistici și performanță</h2>
        <p>O privire de ansamblu asupra pregătirii tale pentru admiterea la medicină.</p></div>
      <div className="performance-controls">
        <div className="performance-period" role="group" aria-label="Interval statistici">
          {(['7', '30', 'all'] as Period[]).map((item) => <button key={item} type="button"
            className={period === item ? 'is-active' : ''} aria-pressed={period === item}
            onClick={() => setPeriod(item)}>{item === 'all' ? 'Tot timpul' : `${item} zile`}</button>)}
        </div>
        <div className="performance-date"><span>Perioada selectată</span><strong>{dateText}</strong></div>
      </div>
    </div>

    <div className="performance-top">
      <div className="performance-accuracy performance-panel">
        <div className="performance-panel-head"><div><h3>Rata răspunsurilor corecte</h3><p>Din răspunsurile trimise</p></div>
          <span className="performance-range">{periodLabels[period]}</span></div>
        <div className="performance-accuracy-content">
          <div className="performance-accuracy-summary"><button type="button" className="performance-big-number" onClick={() => onOpenStat(0, percentLabel(data.accuracy), periodLabels[period])}
            aria-label={`Detalii rata răspunsurilor corecte: ${percentLabel(data.accuracy)}`}>{percentLabel(data.accuracy)}</button>
            {data.accuracyDelta !== null && <span className={`performance-delta ${data.accuracyDelta < 0 ? 'is-negative' : ''}`}>
              {data.accuracyDelta > 0 ? '+' : ''}{data.accuracyDelta} pp</span>}
            <small>{data.accuracyDelta !== null ? 'față de perioada anterioară' : `${data.totalAnswers} răspunsuri în această perioadă`}</small></div>
          <TrendChart points={data.accuracyPoints} max={100} ticks={['100%', '75%', '50%', '25%', '0%']} id="accuracy" />
        </div>
      </div>
      <div className="performance-sim performance-panel">
        <div className="performance-sim-head"><div><h3>Simulări</h3><p>Rezultatele tale la simulări</p></div>
          <button type="button" onClick={onViewSimulations}>Vezi toate simulările <span aria-hidden="true">→</span></button></div>
        <div className="performance-sim-list">{simRows.map((row) => <button key={row.index} type="button" className="performance-sim-row"
          onClick={() => onOpenStat(row.index, percentLabel(row.value), periodLabels[period])}>
          <span className="performance-sim-copy"><strong>{row.label}</strong><small>{row.note}</small></span>
          <span className="performance-sim-measure"><strong>{percentLabel(row.value)}</strong>
            <span className="performance-bar"><i style={{ width: `${row.value ?? 0}%` }} /></span></span>
        </button>)}</div>
      </div>
    </div>

    <div className="performance-bottom">
      <div className="performance-activity performance-panel">
        <h3>Ritmul de studiu</h3><p>Zile consecutive cu activitate</p>
        <div className="performance-activity-body"><button type="button" className="performance-streak"
          aria-label={`Detalii seria actuală de zile active: ${data.streak} ${data.streak === 1 ? 'zi' : 'zile'}`}
          onClick={() => onOpenStat(4, `${data.streak} ${data.streak === 1 ? 'zi' : 'zile'}`, 'Seria curentă')}>
          <strong>{data.streak} {data.streak === 1 ? 'zi' : 'zile'}</strong><span>Seria actuală de zile active</span></button>
          <div className="performance-calendar"><div className="performance-weekdays">{Array.from({ length: 7 }, (_, index) => <span key={index}>{heatmapLabels[(heatmapFirstDay + index) % 7]}</span>)}</div>
            <div className="performance-heatmap">{data.heatDays.map((day) => <span key={day.key} className={day.active ? 'is-active' : ''}
              title={`${shortDate(day.key)}: ${day.active ? 'zi cu activitate' : 'fără activitate'}`} />)}</div>
            <small>Ultimele 4 săptămâni</small><div className="performance-legend"><i /> Zi cu activitate <i /> Fără activitate</div></div></div>
      </div>
      <div className="performance-time performance-panel"><h3>Timp mediu pe întrebare</h3><p>Din simulările finalizate</p>
        <button type="button" className="performance-mid-number" aria-label={`Detalii timp mediu pe întrebare: ${secondsLabel(data.avgSeconds)}`}
          onClick={() => onOpenStat(5, secondsLabel(data.avgSeconds), periodLabels[period])}>{secondsLabel(data.avgSeconds)}</button>
        {data.timeDelta !== null && <small className={`performance-time-delta ${data.timeDelta > 0 ? 'is-negative' : ''}`}>
          {data.timeDelta > 0 ? '+' : ''}{data.timeDelta} sec față de perioada anterioară</small>}
        <TrendChart points={data.timePoints} max={timeTickMax} ticks={[`${timeTickMax}`, `${timeTickMax / 2}`, '0']} id="time" />
      </div>
      <div className="performance-ontime performance-panel"><h3>În timpul alocat</h3><p>Simulări terminate în timpul alocat</p>
        <div className="performance-ontime-content"><button type="button" className="performance-mid-number"
          aria-label={`Detalii simulări terminate în timpul alocat: ${data.onTime} din ${data.totalSim}`}
          onClick={() => onOpenStat(6, String(data.onTime), periodLabels[period])}>{data.onTime} din {data.totalSim}</button>
          <div className="performance-ring" style={{ '--progress': `${data.totalSim ? (data.onTime / data.totalSim) * 100 : 0}%` } as CSSProperties}>
            <strong>{data.totalSim ? `${Math.round((data.onTime / data.totalSim) * 100)}%` : '—'}</strong></div></div>
        <div className="performance-ontime-bar" aria-label={`${data.onTime} din ${data.totalSim} simulări finalizate în timp`}>
          {data.totalSim ? Array.from({ length: Math.min(data.totalSim, 12) }, (_, index) => <span key={index}
            className={index / Math.min(data.totalSim, 12) < data.onTime / data.totalSim ? 'is-active' : ''} />)
            : <span className="is-empty" />}</div>
        <div className="performance-legend"><i /> Finalizată în timp <i /> Depășit timpul</div>
      </div>
    </div>
    <div className="performance-chapters performance-panel"><div className="performance-chapters-copy"><h3>Capitole începute</h3>
      <p>Ai răspuns la cel puțin o grilă</p></div><button type="button" className="performance-chapters-number"
        aria-label={`Detalii capitole începute: ${data.started} din ${data.totalLessons}`}
        onClick={() => onOpenStat(7, String(data.started), periodLabels[period])}>{data.started} <span>/ {data.totalLessons}</span></button>
      <div className="performance-chapter-bar" aria-label={`${data.started} din ${data.totalLessons} capitole începute`}>
        {data.totalLessons ? Array.from({ length: Math.min(data.totalLessons, 20) }, (_, index) => <span key={index}
          className={index / Math.min(data.totalLessons, 20) < data.started / data.totalLessons ? 'is-active' : ''} />) : <span className="is-empty" />}</div>
      <button type="button" className="performance-details" onClick={onViewChapters}>Vezi detalii <span aria-hidden="true">→</span></button></div>
  </section>;
}
