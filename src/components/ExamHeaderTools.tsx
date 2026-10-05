import type { CSSProperties, MouseEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import type { VisualComfortTheme } from '@/hooks/useVisualComfort';
import VisualComfortPicker from '@/components/VisualComfortPicker';

type Props = {
  comfortTheme: VisualComfortTheme;
  onComfortChange: (theme: VisualComfortTheme) => void;
  onHome: () => void;
  homeVariant: 'biology' | 'umfcd' | 'practice';
};

const HOME_ACCENTS = { biology: '#17634a', umfcd: '#245b85', practice: '#842d42' };

export default function ExamHeaderTools({ comfortTheme, onComfortChange, onHome, homeVariant }: Props) {
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
        className="practice-exam__header-action practice-exam__header-action--help"
        onClick={openSupport}
        aria-label="Ai întrebări? Suntem aici pentru tine. Deschide asistența"
        title="Ai întrebări?"
      >
        <MessageCircle size={22} strokeWidth={1.8} aria-hidden="true" />
        <span className="practice-exam__header-help-copy">
          <strong>Ai întrebări?</strong>
          <small>Suntem aici pentru tine.</small>
        </span>
      </button>
      <VisualComfortPicker value={comfortTheme} onChange={onComfortChange} />
      <button
        type="button"
        className="simulation-intro__home"
        style={{ '--intro-accent': HOME_ACCENTS[homeVariant] } as CSSProperties}
        onClick={onHome}
        aria-label="Acasă"
        title="Acasă"
      >
        <img src="/Home.png" alt="" width={22} height={22} />
        <span>Acasă</span>
      </button>
    </div>
  );
}
