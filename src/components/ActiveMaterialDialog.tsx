import { useEffect, useRef } from 'react';
import MaterialLocationCard from '@/components/MaterialLocationCard';
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
        <svg className="active-material-dialog__accent" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
          <path d="M60 0H240V176C151 145 98 88 60 0Z" fill="#e2f2ec" />
          <path d="M164 0H240V121C193 90 170 49 164 0Z" fill="#cbe7dc" />
          <path d="M25 0C65 107 103 127 164 152C207 169 222 198 240 231" fill="none" stroke="#add9c9" strokeWidth="1" />
        </svg>
        <h2 id="active-material-dialog-title" className={verificationError ? 'active-material-dialog__title--error' : undefined}>
          {verificationError ? 'Nu am putut verifica progresul' : 'Rezolvare în desfășurare'}
        </h2>
        {material && !verificationError && (
          <div className="active-material-dialog__material-row">
            <div className="active-material-dialog__material">
              <MaterialLocationCard section={material.section} name={material.name} />
            </div>
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
