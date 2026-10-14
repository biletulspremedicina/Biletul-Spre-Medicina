import type { VisualComfortTheme } from '@/hooks/useVisualComfort';

const OPTIONS: { theme: VisualComfortTheme; label: string }[] = [
  { theme: 'light', label: 'Temă albă' },
  { theme: 'dark', label: 'Temă închisă' },
  { theme: 'vanilla', label: 'Galben vanilie' },
  { theme: 'blue', label: 'Albastru pal' },
];

type Props = {
  value: VisualComfortTheme;
  onChange: (theme: VisualComfortTheme) => void;
};

export default function VisualComfortPicker({ value, onChange }: Props) {
  return (
    <div className="practice-exam__comfort-control" role="radiogroup" aria-label="Confort vizual">
      <span className="practice-exam__comfort-label">Confort vizual</span>
      <div className="practice-exam__comfort-actions">
        {OPTIONS.map(({ theme, label }, index) => (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-label={label}
            aria-checked={value === theme}
            title={label}
            tabIndex={value === theme ? 0 : -1}
            className={`practice-exam__comfort-swatch practice-exam__comfort-swatch--${theme}`}
            onClick={() => onChange(theme)}
            onKeyDown={(event) => {
              const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
              if (!direction) return;
              event.preventDefault();
              const nextIndex = (index + direction + OPTIONS.length) % OPTIONS.length;
              onChange(OPTIONS[nextIndex].theme);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
            }}
          />
        ))}
      </div>
    </div>
  );
}
