import { useEffect, useState } from 'react';

function getNextSimDate(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(20, 0, 0, 0);
  if (now.getHours() >= 20) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function calcTimeLeft(target: Date): TimeLeft {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export function CountdownTimer() {
  const [target] = useState(getNextSimDate);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(calcTimeLeft(target));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const units: { value: number; label: string }[] = [
    { value: timeLeft.days, label: 'ZILE' },
    { value: timeLeft.hours, label: 'ORE' },
    { value: timeLeft.minutes, label: 'MIN' },
    { value: timeLeft.seconds, label: 'SEC' },
  ];

  return (
    <div className="mx-auto flex items-center justify-center gap-2 sm:gap-3 md:gap-4 overflow-x-auto">
      {units.map((unit, i) => (
        <div key={unit.label} className="flex items-center gap-3 sm:gap-4">
          <FlipUnit value={unit.value} label={unit.label} />
          {i < units.length - 1 && (
            <span className="font-display text-2xl font-extrabold text-brand-500/40 sm:text-3xl md:text-4xl" aria-hidden="true">:</span>
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
      <div className="rounded-xl border border-brand-500/20 bg-stone-800/80 px-2.5 py-2 shadow-lg sm:px-4 sm:py-3 md:px-6 md:py-4">
        <div className="flex gap-1 sm:gap-1.5">
          {display.split('').map((digit, idx) => (
            <FlipDigit key={idx} digit={digit} />
          ))}
        </div>
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 sm:text-xs">{label}</span>
    </div>
  );
}

function FlipDigit({ digit }: { digit: string }) {
  const [displayDigit, setDisplayDigit] = useState(digit);

  useEffect(() => {
    if (digit !== displayDigit) {
      setDisplayDigit(digit);
    }
  }, [digit, displayDigit]);

  return (
    <div className="relative h-10 w-6 overflow-hidden sm:h-12 sm:w-8 md:h-14 md:w-10" aria-hidden="true">
      <span
        key={displayDigit}
        className="absolute inset-0 flex items-center justify-center font-display text-2xl font-extrabold tabular-nums text-white sm:text-3xl md:text-4xl animate-[slideDownIn_0.3s_ease-out]"
      >
        {displayDigit}
      </span>
    </div>
  );
}
