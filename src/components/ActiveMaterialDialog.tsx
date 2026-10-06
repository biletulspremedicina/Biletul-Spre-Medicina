import { useEffect, useRef } from 'react';
import { BookOpen } from 'lucide-react';
import type { ActiveMaterial } from '@/lib/activeMaterial';
import './ActiveMaterialDialog.css';

type Props = {
  material: ActiveMaterial | null;
  verificationError: boolean;
  onClose: () => void;
  onOpenMaterial: (material: ActiveMaterial) => void;
};

export default function ActiveMaterialDialog({ material, verificationError, onClose, onOpenMaterial }: Props) {
  const dismissButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (continueButtonRef.current || dismissButtonRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const first = continueButtonRef.current || dismissButtonRef.current;
        const last = dismissButtonRef.current;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="active-material-dialog__backdrop">
      <section className="active-material-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="active-material-dialog-title" aria-describedby="active-material-dialog-description">
        <span className="active-material-dialog__exclamation" aria-hidden="true" />
        <h2 id="active-material-dialog-title">{verificationError ? 'Nu am putut verifica progresul' : 'Ai deja o rezolvare în desfășurare'}</h2>
        {material && !verificationError && (
          <div className="active-material-dialog__material">
            <div className="active-material-dialog__material-section">
              <span className="active-material-dialog__material-icon"><BookOpen size={19} strokeWidth={1.8} aria-hidden="true" /></span>
              <span>{material.section}</span>
            </div>
            <p className="active-material-dialog__material-name">{material.name}</p>
          </div>
        )}
        <p id="active-material-dialog-description" className="active-material-dialog__description">
          {verificationError ? (
            'Încearcă din nou în câteva momente. Nu am pornit un material nou, pentru a-ți păstra progresul.'
          ) : (
            'Trimite răspunsurile de acolo înainte de a începe alt material.'
          )}
        </p>
        <div className="active-material-dialog__actions">
          {material && !verificationError && (
            <button ref={continueButtonRef} type="button" className="active-material-dialog__button active-material-dialog__button--continue"
              onClick={() => onOpenMaterial(material)}>
              Continuă rezolvarea
            </button>
          )}
          <button ref={dismissButtonRef} type="button" className="active-material-dialog__button active-material-dialog__button--dismiss" onClick={onClose}>
            Am înțeles
          </button>
        </div>
      </section>
    </div>
  );
}
