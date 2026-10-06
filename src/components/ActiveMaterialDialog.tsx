import { useEffect, useRef } from 'react';
import { ArrowUpRight, CircleAlert, ChevronRight } from 'lucide-react';
import type { ActiveMaterial } from '@/lib/activeMaterial';
import './ActiveMaterialDialog.css';

type Props = {
  material: ActiveMaterial | null;
  verificationError: boolean;
  onClose: () => void;
  onOpenMaterial: (material: ActiveMaterial) => void;
};

export default function ActiveMaterialDialog({ material, verificationError, onClose, onOpenMaterial }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const materialButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buttonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const first = materialButtonRef.current || buttonRef.current;
        const last = buttonRef.current;
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
        <div className="active-material-dialog__icon"><CircleAlert size={40} strokeWidth={1.8} aria-hidden="true" /></div>
        <h2 id="active-material-dialog-title">{verificationError ? 'Nu am putut verifica progresul' : 'Ai deja o rezolvare în desfășurare'}</h2>
        {material && !verificationError && (
          <button ref={materialButtonRef} type="button" className="active-material-dialog__material"
            onClick={() => onOpenMaterial(material)} aria-label={`Continuă rezolvarea: ${material.name}`}>
            <span>{material.name}</span><ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <p id="active-material-dialog-description" className="active-material-dialog__description">
          {verificationError ? (
            'Încearcă din nou în câteva momente. Nu am pornit un material nou, pentru a-ți păstra progresul.'
          ) : (
            'Trimite răspunsurile de acolo înainte de a începe alt material.'
          )}
        </p>
        <button ref={buttonRef} type="button" className="active-material-dialog__button" onClick={onClose}>
          Am înțeles <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
