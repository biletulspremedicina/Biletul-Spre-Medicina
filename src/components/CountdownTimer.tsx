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

export function CountdownTimer() {
  const [release, setRelease] = useState<MaterialReleaseRPC | null>(null);
  const [now, setNow] = useState(Date.now);

  const loadRelease = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_material_release_state');
    if (error) {
      console.error('Landing material release load error:', error);
      return;
    }
    setRelease(((data || []) as unknown as MaterialReleaseRPC[])[0] || null);
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
  const timeLeft = useMemo(() => calcTimeLeft(target, now), [target, now]);
  const units: { value: number; label: string }[] = [
    { value: timeLeft.days, label: 'ZILE' },
    { value: timeLeft.hours, label: 'ORE' },
    { value: timeLeft.minutes, label: 'MIN' },
    { value: timeLeft.seconds, label: 'SEC' },
  ];

  return (
    <div
      className="relative mx-auto flex items-center justify-center gap-2 overflow-x-auto sm:gap-3 md:gap-4"
      aria-label="Timp până la următoarele materiale"
    >
      {units.map((unit, i) => (
        <div key={unit.label} className="flex items-center gap-3 sm:gap-4">
          <FlipUnit value={unit.value} label={unit.label} />
          {i < units.length - 1 && (
            <span className="font-display text-2xl font-extrabold text-white/40 sm:text-3xl md:text-4xl" aria-hidden="true">:</span>
          )}
        </div>
      ))}
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
