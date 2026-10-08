import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, type MaterialReleaseRPC } from '@/lib/supabase';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const EMPTY_TIME: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function calcTimeLeft(target: string | null, now: number): TimeLeft {
  if (!target) return EMPTY_TIME;
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

export function CountdownTimer({ onSignIn }: { onSignIn: () => void }) {
  const [release, setRelease] = useState<MaterialReleaseRPC | null>(null);
  const [now, setNow] = useState(Date.now);
  const [loaded, setLoaded] = useState(false);

  const loadRelease = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_material_release_state');
    if (error) {
      console.error('Landing material release load error:', error);
      setLoaded(true);
      return;
    }
    const releases = (data || []) as unknown as MaterialReleaseRPC[];
    setRelease(releases.find((item) => item.out_phase === 'countdown') || releases[0] || null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void loadRelease();
    const refreshInterval = window.setInterval(() => void loadRelease(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadRelease();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadRelease]);

  useEffect(() => {
    const tickInterval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tickInterval);
  }, []);

  useEffect(() => {
    if (!release || release.out_phase !== 'countdown') return;
    const remaining = new Date(release.out_available_at).getTime() - Date.now();
    if (remaining <= 0) {
      const retry = window.setTimeout(() => void loadRelease(), 1_000);
      return () => window.clearTimeout(retry);
    }
    const timeout = window.setTimeout(
      () => void loadRelease(),
      Math.min(remaining + 250, 2_147_000_000)
    );
    return () => window.clearTimeout(timeout);
  }, [release, loadRelease]);

  const target = release?.out_phase === 'countdown' ? release.out_available_at : null;
  const countingDown = Boolean(target);
  const timeLeft = useMemo(() => calcTimeLeft(target, now), [target, now]);
  const units: { value: number; label: string }[] = [
    { value: timeLeft.days, label: 'ZILE' },
    { value: timeLeft.hours, label: 'ORE' },
    { value: timeLeft.minutes, label: 'MIN' },
    { value: timeLeft.seconds, label: 'SEC' },
  ];

  if (!loaded) {
    return <p className="py-12 text-center text-stone-400">Se verifică următoarea lansare...</p>;
  }

  if (!countingDown) {
    const justReleased = release?.out_phase === 'celebrating' || Boolean(target);
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center" aria-live="polite">
        <span className="mb-5 h-px w-12 bg-emerald-400/70" aria-hidden="true" />
        <h2 className="font-display text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">
          {justReleased ? 'Materialele sunt acum disponibile' : 'Descoperă materialele disponibile'}
        </h2>
        {justReleased && release && (
          <p className="mt-4 text-base text-stone-300 sm:text-lg">
            <span className="text-emerald-300">{release.out_section_label}</span>
            {' · '}{release.out_title}
          </p>
        )}
        <button type="button" onClick={onSignIn}
          className="mt-8 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          Intră în platformă <span className="ml-2" aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-9 font-display text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">
        Materiale noi pe platformă în:
      </h2>
      <div className="relative mx-auto flex items-center justify-center gap-2 overflow-x-auto sm:gap-3 md:gap-4"
        aria-label="Timp până la următoarele materiale">
        {units.map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-3 sm:gap-4">
            <FlipUnit value={unit.value} label={unit.label} />
            {i < units.length - 1 && (
              <span className="font-display text-2xl font-extrabold text-white/40 sm:text-3xl md:text-4xl" aria-hidden="true">:</span>
            )}
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-xl text-stone-400">
        Alătură-te comunității de viitori medici și fii primul care accesează noile simulări și grile explicate.
      </p>
    </div>
  );
}

function FlipUnit({ value, label }: { value: number; label: string }) {
  const display = pad(value);
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-xl bg-white px-2.5 py-2 shadow-lg ring-1 ring-black/5 sm:px-4 sm:py-3 md:px-6 md:py-4">
        <div className="flex gap-1 sm:gap-1.5">
          {display.split('').map((digit, idx) => (
            <FlipDigit key={idx} digit={digit} />
          ))}
        </div>
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/70 sm:text-xs">{label}</span>
    </div>
  );
}

function FlipDigit({ digit }: { digit: string }) {
  const [displayDigit, setDisplayDigit] = useState(digit);

  useEffect(() => {
    if (digit !== displayDigit) setDisplayDigit(digit);
  }, [digit, displayDigit]);

  return (
    <div className="relative h-10 w-6 overflow-hidden sm:h-12 sm:w-8 md:h-14 md:w-10" aria-hidden="true">
      <span
        key={displayDigit}
        className="absolute inset-0 flex items-center justify-center font-display text-2xl font-extrabold tabular-nums text-brand-700 animate-[slideDownIn_0.3s_ease-out] sm:text-3xl md:text-4xl"
      >
        {displayDigit}
      </span>
    </div>
  );
}
