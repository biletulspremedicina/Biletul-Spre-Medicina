import type { MouseEvent } from 'react';
import { House, MessageCircle } from 'lucide-react';
import type { VisualComfortTheme } from '@/hooks/useVisualComfort';
import VisualComfortPicker from '@/components/VisualComfortPicker';

type Props = {
  comfortTheme: VisualComfortTheme;
  onComfortChange: (theme: VisualComfortTheme) => void;
  onHome: () => void;
};

export default function ExamHeaderTools({ comfortTheme, onComfortChange, onHome }: Props) {
  const openSupport = (event: MouseEvent<HTMLButtonElement>) => {
    const anchor = event.currentTarget.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('bsm:open-support', {
      detail: { anchor: { left: anchor.left, right: anchor.right, bottom: anchor.bottom, width: anchor.width } },
    }));
  };

  return (
    <div className="practice-exam__header-tools">
      <button
        type="button"
        className="practice-exam__header-action"
        onClick={openSupport}
        aria-label="Ai întrebări? Deschide asistența"
        title="Ai întrebări?"
      >
        <MessageCircle size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>Ai întrebări?</span>
      </button>
      <VisualComfortPicker value={comfortTheme} onChange={onComfortChange} />
      <button
        type="button"
        className="practice-exam__header-action practice-exam__header-action--home"
        onClick={onHome}
        aria-label="Acasă"
        title="Acasă"
      >
        <House size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>Acasă</span>
      </button>
    </div>
  );
}
